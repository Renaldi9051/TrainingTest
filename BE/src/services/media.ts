import { randomUUID } from "node:crypto";
import type { HomeSectionType, Media, Prisma } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import { detectFileType, MAX_UPLOAD_BYTES } from "@/lib/file-type";
import { HttpError } from "@/lib/http";
import { processRasterImage, readSvgSize, VARIANT_WIDTHS } from "@/lib/image";
import { collectMediaRefs, type MediaKind } from "@/lib/media-refs";
import { revalidateEntity } from "@/lib/revalidate-map";
import { monthFolder, saveUpload, uploadUrl } from "@/lib/storage";
import { sanitizeSvg } from "@/lib/svg";
import { HOME_SECTION_LABELS } from "@/lib/validators/home-section";
import type { MediaListQuery, MediaUpdateInput } from "@/lib/validators/media";
import { PAGE_BLOCK_LABELS, type PageBlockType } from "@/lib/validators/page-blocks";
import {
  SETTING_KEYS,
  SETTING_LABELS,
  SETTING_MEDIA_FIELDS,
  settingMediaIds,
  type SettingKey,
} from "@/lib/validators/settings";
import { AuditAction, writeAudit } from "@/services/audit";

// ===== DTO =====

type StoredVariant = { path: string; width: number; height: number; size: number };
type StoredVariants = Partial<Record<string, StoredVariant>>;

export type MediaVariantDto = { url: string; width: number; height: number };

export type MediaDto = {
  id: string;
  url: string;
  originalName: string | null;
  mime: string;
  size: number;
  width: number | null;
  height: number | null;
  alt: string | null;
  folder: string | null;
  variants: Record<string, MediaVariantDto> | null;
  createdAt: Date;
  updatedAt: Date;
};

export function toMediaDto(media: Media): MediaDto {
  const stored = (media.variants ?? null) as StoredVariants | null;
  const variants = stored
    ? Object.fromEntries(
        Object.entries(stored).flatMap(([key, variant]) =>
          variant
            ? [[key, { url: uploadUrl(variant.path), width: variant.width, height: variant.height }]]
            : [],
        ),
      )
    : null;

  return {
    id: media.id,
    url: uploadUrl(media.path),
    originalName: media.originalName,
    mime: media.mime,
    size: media.size,
    width: media.width,
    height: media.height,
    alt: media.alt,
    folder: media.folder,
    variants,
    createdAt: media.createdAt,
    updatedAt: media.updatedAt,
  };
}

// Gambar di respons publik: tanpa metadata admin (nama file asli, folder, ukuran file).
export type PublicImage = Pick<MediaDto, "url" | "alt" | "width" | "height" | "mime" | "variants">;

export function toPublicImage(media: MediaDto | null | undefined): PublicImage | null {
  if (!media) return null;
  return {
    url: media.url,
    alt: media.alt,
    width: media.width,
    height: media.height,
    mime: media.mime,
    variants: media.variants,
  };
}

// ===== Upload =====

export type UploadInput = { name: string; data: Uint8Array };
export type UploadFailure = { name: string; code: string; message: string };

const MAX_NAME_LENGTH = 255;

function uploadError(code: string, message: string): HttpError {
  return new HttpError(422, code, message);
}

// Memproses satu file: validasi, konversi, tulis ke disk, simpan ke DB. Melempar HttpError per file.
async function storeOne(
  file: UploadInput,
  folder: string | null,
  userId: string,
  now: Date,
): Promise<MediaDto> {
  if (file.data.byteLength === 0) throw uploadError("EMPTY_FILE", "File kosong.");
  if (file.data.byteLength > MAX_UPLOAD_BYTES) {
    throw uploadError("FILE_TOO_LARGE", "Ukuran file maksimal 10 MB.");
  }

  const type = await detectFileType(file.data);
  if (!type) {
    throw uploadError(
      "UNSUPPORTED_TYPE",
      "Jenis file tidak didukung. Gunakan JPG, PNG, WebP, SVG, atau PDF.",
    );
  }

  const baseName = `${monthFolder(now)}/${randomUUID()}`;
  const originalName = file.name.slice(0, MAX_NAME_LENGTH) || null;
  let data: Prisma.MediaCreateInput;

  if (type.kind === "raster") {
    let processed;
    try {
      processed = await processRasterImage(file.data);
    } catch {
      throw uploadError("INVALID_IMAGE", "Gambar rusak atau tidak dapat diproses.");
    }
    const mainPath = `${baseName}.webp`;
    await saveUpload(mainPath, processed.main.data);
    const variants: StoredVariants = {};
    for (const width of VARIANT_WIDTHS) {
      const variant = processed.variants[width];
      const variantPath = `${baseName}-${width}.webp`;
      await saveUpload(variantPath, variant.data);
      variants[width] = {
        path: variantPath,
        width: variant.width,
        height: variant.height,
        size: variant.size,
      };
    }
    data = {
      path: mainPath,
      originalName,
      mime: "image/webp",
      size: processed.main.size,
      width: processed.main.width,
      height: processed.main.height,
      variants,
    };
  } else if (type.kind === "svg") {
    const clean = sanitizeSvg(new TextDecoder().decode(file.data));
    if (!clean) throw uploadError("INVALID_SVG", "File SVG tidak valid.");
    const bytes = new TextEncoder().encode(clean);
    const size = await readSvgSize(clean);
    const path = `${baseName}.svg`;
    await saveUpload(path, bytes);
    data = {
      path,
      originalName,
      mime: type.mime,
      size: bytes.byteLength,
      width: size?.width ?? null,
      height: size?.height ?? null,
    };
  } else {
    const path = `${baseName}.pdf`;
    await saveUpload(path, file.data);
    data = { path, originalName, mime: type.mime, size: file.data.byteLength };
  }

  const media = await getDb().media.create({
    data: { ...data, folder, updatedBy: { connect: { id: userId } } },
  });
  await writeAudit({
    userId,
    action: AuditAction.CREATE,
    entity: "Media",
    entityId: media.id,
    diff: { path: media.path, mime: media.mime, size: media.size, originalName },
  });
  return toMediaDto(media);
}

export async function uploadMedia(
  files: UploadInput[],
  options: { folder: string | null; userId: string },
  now = new Date(),
): Promise<{ created: MediaDto[]; failed: UploadFailure[] }> {
  const created: MediaDto[] = [];
  const failed: UploadFailure[] = [];

  // Berurutan supaya pemakaian memori sharp tetap rendah.
  for (const file of files) {
    try {
      created.push(await storeOne(file, options.folder, options.userId, now));
    } catch (error) {
      if (!(error instanceof HttpError)) throw error;
      failed.push({ name: file.name, code: error.code, message: error.message });
    }
  }

  if (created.length > 0) await revalidateEntity({ entity: "Media" });
  return { created, failed };
}

// ===== List & update =====

export async function listMedia(query: MediaListQuery) {
  const where: Prisma.MediaWhereInput = {
    deletedAt: null,
    ...(query.folder ? { folder: query.folder } : {}),
    ...(query.type === "image" ? { mime: { startsWith: "image/" } } : {}),
    ...(query.type === "pdf" ? { mime: "application/pdf" } : {}),
    ...(query.q
      ? {
          OR: [
            { originalName: { contains: query.q, mode: "insensitive" } },
            { alt: { contains: query.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const db = getDb();
  const [items, total] = await Promise.all([
    db.media.findMany({
      where,
      orderBy: [{ createdAt: query.sort === "oldest" ? "asc" : "desc" }, { id: "asc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    db.media.count({ where }),
  ]);

  return {
    items: items.map(toMediaDto),
    meta: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    },
  };
}

export async function listMediaFolders(): Promise<string[]> {
  const rows = await getDb().media.findMany({
    where: { deletedAt: null, folder: { not: null } },
    distinct: ["folder"],
    select: { folder: true },
    orderBy: { folder: "asc" },
  });
  return rows.flatMap((row) => (row.folder ? [row.folder] : []));
}

// ===== Referensi dari konten =====

type MediaReader = Pick<Prisma.TransactionClient, "media">;

// Semua referensi gambar di konten disimpan sebagai mediaId. Saat simpan, pastikan media itu
// ada, belum dihapus, dan berupa gambar. Error dikembalikan per field form.
export async function assertImageMedia(
  refs: Record<string, string | null | undefined>,
  db: MediaReader = getDb(),
): Promise<void> {
  await assertMediaRefs(
    Object.entries(refs).map(([field, mediaId]) => ({ field, mediaId, kind: "image" as const })),
    db,
  );
}

export type MediaRefCheck = { field: string; mediaId: string | null | undefined; kind: MediaKind };

const MEDIA_KIND_ERROR: Record<MediaKind, string> = {
  image: "Gambar tidak ditemukan atau sudah dihapus.",
  pdf: "File PDF tidak ditemukan atau sudah dihapus.",
};

function matchesKind(mime: string, kind: MediaKind): boolean {
  return kind === "image" ? mime.startsWith("image/") : mime === "application/pdf";
}

// Seperti assertImageMedia, untuk referensi dengan jenis berbeda (gambar/PDF), mis. mediaId di
// JSON blok halaman. `field` = path field form (mis. "blocks.3.file").
export async function assertMediaRefs(refs: MediaRefCheck[], db: MediaReader = getDb()): Promise<void> {
  const ids = [...new Set(refs.flatMap((ref) => (ref.mediaId ? [ref.mediaId] : [])))];
  if (ids.length === 0) return;
  const found = await db.media.findMany({
    where: { id: { in: ids }, deletedAt: null },
    select: { id: true, mime: true },
  });
  const mimeById = new Map(found.map((row) => [row.id, row.mime]));
  const fields: Record<string, string[]> = {};
  for (const ref of refs) {
    if (!ref.mediaId) continue;
    const mime = mimeById.get(ref.mediaId);
    if (!mime || !matchesKind(mime, ref.kind)) fields[ref.field] = [MEDIA_KIND_ERROR[ref.kind]];
  }
  if (Object.keys(fields).length > 0) {
    throw new HttpError(422, "VALIDATION_ERROR", "Data tidak valid.", fields);
  }
}

// Media aktif berdasarkan id, untuk melengkapi respons (logo, cover, OG). Id yang hilang dilewati.
export async function getMediaMap(
  ids: (string | null | undefined)[],
  db: MediaReader = getDb(),
): Promise<Map<string, MediaDto>> {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (unique.length === 0) return new Map();
  const rows = await db.media.findMany({ where: { id: { in: unique }, deletedAt: null } });
  return new Map(rows.map((row) => [row.id, toMediaDto(row)]));
}

async function findActiveMedia(id: string): Promise<Media> {
  const media = await getDb().media.findFirst({ where: { id, deletedAt: null } });
  if (!media) throw new HttpError(404, "NOT_FOUND", "Media tidak ditemukan.");
  return media;
}

export async function getMedia(id: string): Promise<MediaDto> {
  return toMediaDto(await findActiveMedia(id));
}

export async function updateMedia(
  id: string,
  input: MediaUpdateInput,
  userId: string,
): Promise<MediaDto> {
  const before = await findActiveMedia(id);
  const changes: Prisma.MediaUpdateInput = {};
  if (input.alt !== undefined) changes.alt = input.alt;
  if (input.folder !== undefined) changes.folder = input.folder;

  const media = await getDb().media.update({
    where: { id },
    data: { ...changes, updatedBy: { connect: { id: userId } } },
  });
  await writeAudit({
    userId,
    action: AuditAction.UPDATE,
    entity: "Media",
    entityId: id,
    diff: {
      before: { alt: before.alt, folder: before.folder },
      after: { alt: media.alt, folder: media.folder },
    },
  });
  await revalidateEntity({ entity: "Media" });
  return toMediaDto(media);
}

// ===== Pemakaian & hapus =====

export type MediaUsage = {
  entity:
    | "Training"
    | "Service"
    | "Client"
    | "Testimonial"
    | "MarketingContact"
    | "PortfolioItem"
    | "SiteSetting"
    | "HomeSection"
    | "Page";
  entityLabel: string;
  id: string;
  label: string;
  field: string;
  // Item ada di Sampah; tetap dihitung karena bisa dipulihkan.
  inTrash: boolean;
};

// Jsonpath untuk mencari { mediaId } di tingkat mana pun (konvensi lib/media-refs.ts).
// Jsonpath dan id dikirim sebagai parameter query; id masuk lewat variabel jsonpath
// (jsonb_build_object), tidak pernah digabung ke string query.
const JSON_MEDIA_REF_PATH = "$.**.mediaId ? (@ == $id)";

type JsonContentRow = { id: string; deletedAt: Date | null };
type HomeSectionRow = JsonContentRow & { type: HomeSectionType; title: string | null; content: unknown };
type PageRow = JsonContentRow & { title: string; blocks: unknown };

const JSON_FIELD_LABELS: Record<string, string> = { image: "Gambar", file: "File" };

function jsonFieldLabel(key: string): string {
  return JSON_FIELD_LABELS[key] ?? key;
}

function homeSectionUsages(rows: HomeSectionRow[], mediaId: string): MediaUsage[] {
  return rows.flatMap((row) =>
    collectMediaRefs(row.content)
      .filter((ref) => ref.mediaId === mediaId)
      .map((ref) => ({
        entity: "HomeSection" as const,
        entityLabel: "Beranda",
        id: row.id,
        label: row.title ? `${HOME_SECTION_LABELS[row.type]} (${row.title})` : HOME_SECTION_LABELS[row.type],
        field: jsonFieldLabel(ref.path.split(".").at(-1) ?? ref.path),
        inTrash: row.deletedAt !== null,
      })),
  );
}

// Path blok: "<indeks>.<field>" (mis. "3.file") -> "Blok 4 (Unduhan) › File".
function pageUsages(rows: PageRow[], mediaId: string): MediaUsage[] {
  return rows.flatMap((row) => {
    const blocks = Array.isArray(row.blocks) ? (row.blocks as unknown[]) : [];
    return collectMediaRefs(blocks)
      .filter((ref) => ref.mediaId === mediaId)
      .map((ref) => {
        const [index, ...rest] = ref.path.split(".");
        const block = blocks[Number(index)];
        const type = typeof block === "object" && block !== null ? (block as { type?: unknown }).type : undefined;
        const typeLabel = PAGE_BLOCK_LABELS[type as PageBlockType] ?? "Blok";
        return {
          entity: "Page" as const,
          entityLabel: "Halaman",
          id: row.id,
          label: row.title,
          field: `Blok ${Number(index) + 1} (${typeLabel}) › ${jsonFieldLabel(rest.at(-1) ?? "")}`,
          inTrash: row.deletedAt !== null,
        };
      });
  });
}

// Semua referensi ke Media: relasi di skema (cover, image, logo, photo, galeri), mediaId di JSON
// (SEO pelatihan/layanan/halaman, pengaturan situs, isi section beranda, blok halaman),
// termasuk item di Sampah.
export async function getMediaUsages(mediaId: string): Promise<MediaUsage[]> {
  const db = getDb();
  const [
    trainings,
    trainingSeo,
    services,
    serviceSeo,
    pageSeo,
    clients,
    testimonials,
    marketing,
    portfolio,
    settings,
    homeSections,
    pages,
  ] = await Promise.all([
    db.training.findMany({
      where: { coverId: mediaId },
      select: { id: true, title: true, deletedAt: true },
    }),
    db.training.findMany({
      where: { seo: { path: ["ogImageId"], equals: mediaId } },
      select: { id: true, title: true, deletedAt: true },
    }),
    db.service.findMany({
      where: { imageId: mediaId },
      select: { id: true, title: true, deletedAt: true },
    }),
    db.service.findMany({
      where: { seo: { path: ["ogImageId"], equals: mediaId } },
      select: { id: true, title: true, deletedAt: true },
    }),
    db.page.findMany({
      where: { seo: { path: ["ogImageId"], equals: mediaId } },
      select: { id: true, title: true, deletedAt: true },
    }),
    db.client.findMany({
      where: { logoId: mediaId },
      select: { id: true, name: true, deletedAt: true },
    }),
    db.testimonial.findMany({
      where: { photoId: mediaId },
      select: { id: true, name: true, deletedAt: true },
    }),
    db.marketingContact.findMany({
      where: { photoId: mediaId },
      select: { id: true, name: true, deletedAt: true },
    }),
    db.portfolioImage.findMany({
      where: { mediaId },
      select: { portfolioItem: { select: { id: true, title: true, deletedAt: true } } },
    }),
    db.siteSetting.findMany({
      where: { key: { in: SETTING_KEYS.filter((key) => SETTING_MEDIA_FIELDS[key]) } },
      select: { id: true, key: true, value: true },
    }),
    db.$queryRaw<HomeSectionRow[]>`
      SELECT "id", "type", "title", "content", "deletedAt"
      FROM "HomeSection"
      WHERE jsonb_path_exists("content", ${JSON_MEDIA_REF_PATH}::jsonpath, jsonb_build_object('id', ${mediaId}::text))
    `,
    db.$queryRaw<PageRow[]>`
      SELECT "id", "title", "blocks", "deletedAt"
      FROM "Page"
      WHERE jsonb_path_exists("blocks", ${JSON_MEDIA_REF_PATH}::jsonpath, jsonb_build_object('id', ${mediaId}::text))
    `,
  ]);

  const settingUsages: MediaUsage[] = settings.flatMap((row) => {
    const key = row.key as SettingKey;
    const labels = SETTING_MEDIA_FIELDS[key] ?? {};
    return Object.entries(settingMediaIds(key, row.value))
      .filter(([, id]) => id === mediaId)
      .map(([field]) => ({
        entity: "SiteSetting" as const,
        entityLabel: "Pengaturan situs",
        id: row.key,
        label: SETTING_LABELS[key],
        field: labels[field] ?? field,
        inTrash: false,
      }));
  });

  return [
    ...trainings.map((row) => ({
      entity: "Training" as const,
      entityLabel: "Pelatihan",
      id: row.id,
      label: row.title,
      field: "Sampul",
      inTrash: row.deletedAt !== null,
    })),
    ...trainingSeo.map((row) => ({
      entity: "Training" as const,
      entityLabel: "Pelatihan",
      id: row.id,
      label: row.title,
      field: "Gambar OG",
      inTrash: row.deletedAt !== null,
    })),
    ...services.map((row) => ({
      entity: "Service" as const,
      entityLabel: "Layanan",
      id: row.id,
      label: row.title,
      field: "Gambar",
      inTrash: row.deletedAt !== null,
    })),
    ...clients.map((row) => ({
      entity: "Client" as const,
      entityLabel: "Klien",
      id: row.id,
      label: row.name,
      field: "Logo",
      inTrash: row.deletedAt !== null,
    })),
    ...testimonials.map((row) => ({
      entity: "Testimonial" as const,
      entityLabel: "Testimoni",
      id: row.id,
      label: row.name,
      field: "Foto",
      inTrash: row.deletedAt !== null,
    })),
    ...marketing.map((row) => ({
      entity: "MarketingContact" as const,
      entityLabel: "Kontak marketing",
      id: row.id,
      label: row.name,
      field: "Foto",
      inTrash: row.deletedAt !== null,
    })),
    ...portfolio.map(({ portfolioItem: row }) => ({
      entity: "PortfolioItem" as const,
      entityLabel: "Portofolio",
      id: row.id,
      label: row.title,
      field: "Galeri",
      inTrash: row.deletedAt !== null,
    })),
    ...serviceSeo.map((row) => ({
      entity: "Service" as const,
      entityLabel: "Layanan",
      id: row.id,
      label: row.title,
      field: "Gambar OG",
      inTrash: row.deletedAt !== null,
    })),
    ...pageSeo.map((row) => ({
      entity: "Page" as const,
      entityLabel: "Halaman",
      id: row.id,
      label: row.title,
      field: "Gambar OG",
      inTrash: row.deletedAt !== null,
    })),
    ...settingUsages,
    ...homeSectionUsages(homeSections, mediaId),
    ...pageUsages(pages, mediaId),
  ];
}

export async function deleteMedia(id: string, userId: string): Promise<void> {
  await findActiveMedia(id);
  const usages = await getMediaUsages(id);
  if (usages.length > 0) {
    throw new HttpError(
      409,
      "MEDIA_IN_USE",
      `Media masih dipakai di ${usages.length} tempat. Lepaskan dulu dari konten tersebut sebelum menghapus.`,
      undefined,
      { usages },
    );
  }

  // Soft delete: file tetap di disk supaya media bisa dipulihkan dari Sampah.
  await getDb().media.update({
    where: { id },
    data: { deletedAt: new Date(), updatedBy: { connect: { id: userId } } },
  });
  await writeAudit({ userId, action: AuditAction.DELETE, entity: "Media", entityId: id });
  await revalidateEntity({ entity: "Media" });
}
