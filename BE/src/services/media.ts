import { randomUUID } from "node:crypto";
import type { Media, Prisma } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import { detectFileType, MAX_UPLOAD_BYTES } from "@/lib/file-type";
import { HttpError } from "@/lib/http";
import { processRasterImage, readSvgSize, VARIANT_WIDTHS } from "@/lib/image";
import { revalidateTags, RevalidateTag } from "@/lib/revalidate";
import { monthFolder, saveUpload, uploadUrl } from "@/lib/storage";
import { sanitizeSvg } from "@/lib/svg";
import type { MediaListQuery, MediaUpdateInput } from "@/lib/validators/media";
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

  if (created.length > 0) await revalidateTags([RevalidateTag.MEDIA]);
  return { created, failed };
}

// ===== List & update =====

export async function listMedia(query: MediaListQuery) {
  const where: Prisma.MediaWhereInput = {
    deletedAt: null,
    ...(query.folder ? { folder: query.folder } : {}),
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
  await revalidateTags([RevalidateTag.MEDIA]);
  return toMediaDto(media);
}

// ===== Pemakaian & hapus =====

export type MediaUsage = {
  entity: "Training" | "Service" | "Client" | "Testimonial" | "MarketingContact" | "PortfolioItem";
  entityLabel: string;
  id: string;
  label: string;
  field: string;
  // Item ada di Sampah; tetap dihitung karena bisa dipulihkan.
  inTrash: boolean;
};

// Semua relasi ke Media di skema (cover, image, logo, photo, galeri), termasuk item di Sampah.
export async function getMediaUsages(mediaId: string): Promise<MediaUsage[]> {
  const db = getDb();
  const [trainings, services, clients, testimonials, marketing, portfolio] = await Promise.all([
    db.training.findMany({
      where: { coverId: mediaId },
      select: { id: true, title: true, deletedAt: true },
    }),
    db.service.findMany({
      where: { imageId: mediaId },
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
  ]);

  return [
    ...trainings.map((row) => ({
      entity: "Training" as const,
      entityLabel: "Pelatihan",
      id: row.id,
      label: row.title,
      field: "Sampul",
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
  await revalidateTags([RevalidateTag.MEDIA]);
}
