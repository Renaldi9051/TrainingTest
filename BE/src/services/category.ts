import type { Media, Prisma } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import { HttpError } from "@/lib/http";
import { listMeta, pagination, type ListMeta } from "@/lib/list-query";
import { revalidateEntity } from "@/lib/revalidate-map";
import {
  assertSlugAvailable,
  nextAvailableSlug,
  slugify,
  type SlugLookup,
  withSlugConflict,
} from "@/lib/slug";
import type {
  CategoryAudienceItem,
  CategoryAudienceSource,
  CategoryCreateInput,
  CategoryDeleteQuery,
  CategoryListQuery,
  CategoryUpdateInput,
} from "@/lib/validators/category";
import { audienceSchema } from "@/lib/validators/category";
import type { ReorderInput, RestoreInput } from "@/lib/validators/common";
import { AuditAction, diffFields, writeAudit } from "@/services/audit";
import {
  activeMediaDto,
  assertMediaRefs,
  toPublicImage,
  type MediaDto,
  type PublicImage,
} from "@/services/media";
import { publicPath, recordSlugRedirect, releaseRedirectPath } from "@/services/redirect";
import { reorderResource } from "@/services/reorder";
import { publicTrainingWhere } from "@/services/training-visibility";

const ENTITY = "Category";
const FIELDS = [
  "slug",
  "name",
  "description",
  "summary",
  "icon",
  "featured",
  "order",
  "imageId",
  "coverAlt",
  "audience",
  "audienceSource",
  "keywords",
  "imageIds",
] as const;

// Membaca kolom JSON audience dari DB dengan aman: data rusak/lama jadi array kosong.
export function readCategoryAudience(value: unknown): CategoryAudienceItem[] {
  const parsed = audienceSchema.safeParse(value);
  return parsed.success ? parsed.data : [];
}

// Invariant: audienceSource hanya boleh "auto" kalau audience tidak kosong. Audience kosong selalu
// "manual" (badge "Dirangkum dari ..." tidak boleh tampil tanpa data). Dipakai saat create/update.
export function normalizeAudienceSource(
  audience: CategoryAudienceItem[],
  source: CategoryAudienceSource,
): CategoryAudienceSource {
  return audience.length === 0 ? "manual" : source;
}

export type CategoryDto = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  summary: string | null;
  icon: string | null;
  order: number;
  featured: boolean;
  imageId: string | null;
  image: MediaDto | null;
  coverAlt: string | null;
  audience: CategoryAudienceItem[];
  audienceSource: CategoryAudienceSource;
  // Galeri foto kategori (maks 4), berurutan; gambar yang di Sampah tidak ikut.
  imageIds: string[];
  images: MediaDto[];
  keywords: string[];
  trainingCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export type CategoryOption = { id: string; slug: string; name: string };

// Jumlah pelatihan yang belum dihapus (draft + published) per kategori, untuk admin.
const adminTrainingCount = {
  _count: { select: { trainings: { where: { training: { deletedAt: null } } } } },
} satisfies Prisma.CategoryInclude;

const galleryInclude = {
  images: { orderBy: { order: "asc" }, include: { media: true } },
} satisfies Prisma.CategoryInclude;

const adminInclude = { ...adminTrainingCount, image: true, ...galleryInclude } satisfies Prisma.CategoryInclude;

type CategoryWithCount = Prisma.CategoryGetPayload<{ include: typeof adminInclude }>;

// Galeri aktif (media belum dihapus), urut sesuai order. Toleran kalau relasi images tidak dimuat.
function activeGalleryImages(category: { images?: { media: Media }[] | null }): MediaDto[] {
  return (category.images ?? []).flatMap((link) => activeMediaDto(link.media) ?? []);
}

function toDto(category: CategoryWithCount): CategoryDto {
  const images = activeGalleryImages(category);
  return {
    id: category.id,
    slug: category.slug,
    name: category.name,
    description: category.description,
    summary: category.summary,
    icon: category.icon,
    order: category.order,
    featured: category.featured,
    imageId: category.imageId,
    image: activeMediaDto(category.image),
    coverAlt: category.coverAlt,
    audience: readCategoryAudience(category.audience),
    audienceSource: (category.audienceSource === "auto" ? "auto" : "manual") satisfies CategoryAudienceSource,
    imageIds: images.map((image) => image.id),
    images,
    keywords: category.keywords,
    trainingCount: category._count.trainings,
    createdAt: category.createdAt,
    updatedAt: category.updatedAt,
  };
}

const slugLookup: SlugLookup = (args) => getDb().category.findFirst(args);

// ===== Admin =====

export async function listCategories(
  query: CategoryListQuery,
): Promise<{ items: CategoryDto[]; meta: ListMeta }> {
  const where: Prisma.CategoryWhereInput = {
    deletedAt: null,
    ...(query.featured === undefined ? {} : { featured: query.featured }),
    ...(query.issue === "no-image" ? { imageId: null } : {}),
    ...(query.q
      ? {
          OR: [
            { name: { contains: query.q, mode: "insensitive" } },
            { slug: { contains: query.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const db = getDb();
  if (query.sort.field === "trainingCount") return listByTrainingCount(where, query);
  const [rows, total] = await Promise.all([
    db.category.findMany({
      where,
      include: adminInclude,
      orderBy: [{ [query.sort.field]: query.sort.direction }, { name: "asc" }],
      ...pagination(query.page, query.pageSize),
    }),
    db.category.count({ where }),
  ]);
  return { items: rows.map(toDto), meta: listMeta(query.page, query.pageSize, total) };
}

// Urut jumlah pelatihan aktif: orderBy _count Prisma ikut menghitung tautan pelatihan di Sampah,
// jadi jumlah yang benar dihitung untuk semua kategori yang cocok (ratusan baris), diurutkan di
// sini, lalu halaman yang diminta diambil lengkap.
async function listByTrainingCount(
  where: Prisma.CategoryWhereInput,
  query: CategoryListQuery,
): Promise<{ items: CategoryDto[]; meta: ListMeta }> {
  const db = getDb();
  const counts = await db.category.findMany({ where, select: { id: true, name: true, ...adminTrainingCount } });
  const sign = query.sort.direction === "asc" ? 1 : -1;
  counts.sort((a, b) => sign * (a._count.trainings - b._count.trainings) || a.name.localeCompare(b.name, "id"));
  const { skip, take } = pagination(query.page, query.pageSize);
  const ids = counts.slice(skip, skip + take).map((row) => row.id);
  const rows = await db.category.findMany({ where: { id: { in: ids } }, include: adminInclude });
  const byId = new Map(rows.map((row) => [row.id, row]));
  const items = ids.flatMap((id) => {
    const row = byId.get(id);
    return row ? [toDto(row)] : [];
  });
  return { items, meta: listMeta(query.page, query.pageSize, counts.length) };
}

// Semua kategori aktif (untuk pilihan di form pelatihan dan mode urutkan).
export async function listCategoryOptions(): Promise<CategoryOption[]> {
  return getDb().category.findMany({
    where: { deletedAt: null },
    select: { id: true, slug: true, name: true },
    orderBy: [{ order: "asc" }, { name: "asc" }],
  });
}

export async function findActiveCategory(id: string): Promise<CategoryWithCount> {
  const category = await getDb().category.findFirst({
    where: { id, deletedAt: null },
    include: adminInclude,
  });
  if (!category) throw new HttpError(404, "NOT_FOUND", "Kategori tidak ditemukan.");
  return category;
}

export async function getCategory(id: string): Promise<CategoryDto> {
  return toDto(await findActiveCategory(id));
}

// Setiap gambar galeri: media gambar aktif yang sudah punya alt. Error per index, mis. imageIds.2.
function galleryRefs(imageIds: string[] | undefined) {
  return (imageIds ?? []).map((mediaId, index) => ({
    field: `imageIds.${index}`,
    mediaId,
    kind: "image" as const,
    requireAlt: true,
  }));
}

// Bentuk untuk audit/diff: kolom + daftar id galeri (urut).
function auditShape(category: CategoryWithCount | null) {
  if (!category) return null;
  return { ...category, imageIds: activeGalleryImages(category).map((image) => image.id) };
}

export async function createCategory(input: CategoryCreateInput, userId: string): Promise<CategoryDto> {
  // Slug ditulis admin: bentrok = 409. Slug otomatis dari nama: cari sufiks yang kosong.
  const slug = input.slug ?? (await nextAvailableSlug(slugLookup, slugify(input.name) || "kategori"));
  if (input.slug) await assertSlugAvailable(slugLookup, slug);
  await assertMediaRefs([
    { field: "imageId", mediaId: input.imageId, kind: "image", requireAlt: true },
    ...galleryRefs(input.imageIds),
  ]);

  const last = await getDb().category.aggregate({ where: { deletedAt: null }, _max: { order: true } });
  const order = (last._max.order ?? -1) + 1;

  const created = await withSlugConflict(() =>
    getDb().$transaction(async (tx) => {
      const category = await tx.category.create({
        data: {
          slug,
          name: input.name,
          description: input.description,
          summary: input.summary,
          icon: input.icon,
          featured: input.featured,
          imageId: input.imageId,
          coverAlt: input.coverAlt,
          audience: input.audience as Prisma.InputJsonValue,
          audienceSource: normalizeAudienceSource(input.audience, input.audienceSource),
          keywords: input.keywords,
          order,
          updatedById: userId,
          images: { create: input.imageIds.map((mediaId, index) => ({ mediaId, order: index })) },
        },
        include: adminInclude,
      });
      await releaseRedirectPath(tx, publicPath.category(slug), userId);
      await writeAudit(
        {
          userId,
          action: AuditAction.CREATE,
          entity: ENTITY,
          entityId: category.id,
          diff: diffFields(null, auditShape(category) ?? {}, FIELDS) as Prisma.InputJsonValue,
        },
        tx,
      );
      return category;
    }),
  );

  await revalidateEntity({ entity: "Category", slugs: [created.slug] });
  return toDto(created);
}

export async function updateCategory(
  id: string,
  input: CategoryUpdateInput,
  userId: string,
): Promise<CategoryDto> {
  const before = await findActiveCategory(id);
  const slugChanged = input.slug !== undefined && input.slug !== before.slug;
  if (slugChanged && input.slug) await assertSlugAvailable(slugLookup, input.slug, id);
  await assertMediaRefs([
    { field: "imageId", mediaId: input.imageId, kind: "image", requireAlt: true },
    ...galleryRefs(input.imageIds),
  ]);

  const data: Prisma.CategoryUncheckedUpdateInput = { updatedById: userId };
  if (input.name !== undefined) data.name = input.name;
  if (slugChanged) data.slug = input.slug;
  if (input.description !== undefined) data.description = input.description;
  if (input.summary !== undefined) data.summary = input.summary;
  if (input.icon !== undefined) data.icon = input.icon;
  if (input.featured !== undefined) data.featured = input.featured;
  if (input.imageId !== undefined) data.imageId = input.imageId;
  if (input.coverAlt !== undefined) data.coverAlt = input.coverAlt;
  // Audience & source saling tergantung: kalau salah satu diubah, hitung ulang invariant
  // (source "auto" hanya sah kalau audience tidak kosong) dari nilai efektif (input atau lama).
  if (input.audience !== undefined || input.audienceSource !== undefined) {
    const effectiveAudience = input.audience ?? readCategoryAudience(before.audience);
    const effectiveSource = input.audienceSource ?? (before.audienceSource === "auto" ? "auto" : "manual");
    if (input.audience !== undefined) data.audience = input.audience as Prisma.InputJsonValue;
    data.audienceSource = normalizeAudienceSource(effectiveAudience, effectiveSource);
  }
  if (input.keywords !== undefined) data.keywords = input.keywords;

  const updated = await withSlugConflict(() =>
    getDb().$transaction(async (tx) => {
      // Galeri diganti utuh sesuai urutan imageIds (pola galeri pelatihan).
      if (input.imageIds) {
        await tx.categoryMedia.deleteMany({ where: { categoryId: id } });
        await tx.categoryMedia.createMany({
          data: input.imageIds.map((mediaId, index) => ({ categoryId: id, mediaId, order: index })),
        });
      }
      const category = await tx.category.update({ where: { id }, data, include: adminInclude });
      if (slugChanged) {
        await recordSlugRedirect(tx, {
          from: publicPath.category(before.slug),
          to: publicPath.category(category.slug),
          userId,
        });
      }
      await writeAudit(
        {
          userId,
          action: AuditAction.UPDATE,
          entity: ENTITY,
          entityId: id,
          diff: diffFields(auditShape(before), auditShape(category) ?? {}, FIELDS) as Prisma.InputJsonValue,
        },
        tx,
      );
      return category;
    }),
  );

  await revalidateEntity({ entity: "Category", slugs: [updated.slug, slugChanged ? before.slug : null] });
  return toDto(updated);
}

// Kategori yang masih dipakai pelatihan aktif tidak boleh dihapus, supaya tidak ada pelatihan
// yang kehilangan kategori di halaman publik. Pindahkan dulu lewat bulk action pelatihan, atau
// pakai detach: tautan dilepas lalu kategori dihapus, asalkan setiap pelatihan masih punya kategori
// aktif lain. Item menu yang menuju halaman kategori ikut dipindah ke Sampah.
export async function deleteCategory(id: string, userId: string, { detach = false }: CategoryDeleteQuery = { detach: false }): Promise<void> {
  const category = await findActiveCategory(id);
  const trainingCount = category._count.trainings;
  if (trainingCount > 0 && !detach) {
    throw new HttpError(
      409,
      "CATEGORY_IN_USE",
      `Kategori masih dipakai ${trainingCount} pelatihan. Pindahkan pelatihan tersebut ke kategori lain dulu.`,
      undefined,
      { trainingCount },
    );
  }
  const linked = trainingCount > 0 ? await linkedTrainings(id) : [];
  if (detach) {
    const orphans = linked.filter((training) => training.otherCategories === 0);
    if (orphans.length > 0) {
      throw new HttpError(
        409,
        "CATEGORY_ONLY_CATEGORY",
        `${orphans.length} pelatihan hanya punya kategori ini. Tambahkan kategori lain ke pelatihan tersebut dulu.`,
        undefined,
        { trainings: orphans.slice(0, ORPHAN_PREVIEW_LIMIT).map(({ id: trainingId, title }) => ({ id: trainingId, title })), total: orphans.length },
      );
    }
  }
  const now = new Date();
  const navChanged = await getDb().$transaction(async (tx) => {
    if (linked.length > 0) await tx.trainingCategory.deleteMany({ where: { categoryId: id } });
    await tx.category.update({ where: { id }, data: { deletedAt: now, updatedById: userId } });
    const navItems = await removeCategoryNavItems(tx, category.slug, userId, now);
    await writeAudit(
      {
        userId,
        action: AuditAction.DELETE,
        entity: ENTITY,
        entityId: id,
        diff: {
          slug: category.slug,
          ...(linked.length > 0 ? { detachedTrainings: linked.map((training) => training.id) } : {}),
          ...(navItems.length > 0 ? { removedNavItems: navItems } : {}),
        },
      },
      tx,
    );
    return navItems.length > 0;
  });
  await revalidateEntity([
    { entity: "Category", slugs: [category.slug] },
    ...(linked.length > 0 ? [{ entity: "Training" as const, slugs: linked.map((training) => training.slug) }] : []),
    ...(navChanged ? [{ entity: "Nav" as const }] : []),
  ]);
}

const ORPHAN_PREVIEW_LIMIT = 20;

// Pelatihan (belum dihapus) yang tertaut ke kategori ini + jumlah kategori aktif lainnya.
async function linkedTrainings(categoryId: string) {
  const rows = await getDb().training.findMany({
    where: { deletedAt: null, categories: { some: { categoryId } } },
    select: {
      id: true,
      slug: true,
      title: true,
      categories: { where: { categoryId: { not: categoryId }, category: { deletedAt: null } }, select: { categoryId: true } },
    },
    orderBy: { title: "asc" },
  });
  return rows.map(({ categories, ...training }) => ({ ...training, otherCategories: categories.length }));
}

type NavTx = Pick<Prisma.TransactionClient, "navItem">;

// href menu yang menuju halaman kategori ini (path landing atau katalog terfilter ?kategori=slug).
export function categoryNavHrefs(slug: string): string[] {
  return [publicPath.category(slug), `/pelatihan?kategori=${slug}`];
}

// Kategori dihapus: item menu (dan submenunya) yang menuju halamannya dipindah ke Sampah.
// Mengembalikan id item yang dipindah.
async function removeCategoryNavItems(tx: NavTx, slug: string, userId: string, now: Date): Promise<string[]> {
  const items = await tx.navItem.findMany({
    where: { href: { in: categoryNavHrefs(slug) }, deletedAt: null },
    select: { id: true },
  });
  if (items.length === 0) return [];
  const ids = items.map((item) => item.id);
  await tx.navItem.updateMany({
    where: { OR: [{ id: { in: ids } }, { parentId: { in: ids } }], deletedAt: null },
    data: { deletedAt: now, updatedById: userId },
  });
  return ids;
}

// Pulihkan dari Sampah. Kalau slug lama sudah dipakai kategori lain: 409 dan admin diminta
// mengirim slug baru.
export async function restoreCategory(id: string, input: RestoreInput, userId: string): Promise<CategoryDto> {
  const category = await getDb().category.findFirst({ where: { id, deletedAt: { not: null } } });
  if (!category) throw new HttpError(404, "NOT_FOUND", "Kategori tidak ditemukan di Sampah.");
  const slug = input.slug ?? category.slug;
  await assertSlugAvailable(slugLookup, slug, id);

  const last = await getDb().category.aggregate({ where: { deletedAt: null }, _max: { order: true } });
  const restored = await withSlugConflict(() =>
    getDb().$transaction(async (tx) => {
      const updated = await tx.category.update({
        where: { id },
        data: { deletedAt: null, slug, order: (last._max.order ?? -1) + 1, updatedById: userId },
        include: adminInclude,
      });
      await releaseRedirectPath(tx, publicPath.category(slug), userId);
      await writeAudit(
        {
          userId,
          action: AuditAction.RESTORE,
          entity: ENTITY,
          entityId: id,
          diff: slug === category.slug ? undefined : { slug: { from: category.slug, to: slug } },
        },
        tx,
      );
      return updated;
    }),
  );
  await revalidateEntity({ entity: "Category", slugs: [restored.slug] });
  return toDto(restored);
}

// Urutan semua kategori aktif. Daftar id harus lengkap (pola generik services/reorder.ts).
export async function reorderCategories(input: ReorderInput, userId: string): Promise<void> {
  await reorderResource("categories", input, userId);
}

// ===== Publik =====

export type PublicCategory = {
  slug: string;
  name: string;
  description: string | null;
  // Ringkasan 1 kalimat (meta description landing). null kalau kosong.
  summary: string | null;
  icon: string | null;
  featured: boolean;
  // Cover kategori (juga fallback sampul pelatihan); null kalau kosong atau media di Sampah.
  image: PublicImage | null;
  trainingCount: number;
};

// Pelatihan ringkas untuk daftar judul di landing kategori (tanpa kartu bergambar).
export type PublicCategoryTraining = {
  slug: string;
  title: string;
  types: string[];
};

// Respons GET /api/public/categories/:slug (landing kategori v2).
export type PublicCategoryDetail = PublicCategory & {
  // summary, atau 160 karakter pertama description kalau summary kosong; "" kalau keduanya kosong.
  metaDescription: string;
  // Alt cover: coverAlt, lalu alt Media (sudah termasuk di image.alt).
  coverAlt: string | null;
  // description dipecah per paragraf (baris kosong = pemisah). Kosong = section Tentang disembunyikan.
  descriptionParagraphs: string[];
  audience: CategoryAudienceItem[];
  audienceSource: CategoryAudienceSource;
  // Galeri foto kategori (maks 4), media di Sampah dibuang. Kosong = section Galeri disembunyikan.
  images: PublicImage[];
  // Semua pelatihan tayang di kategori ini, urut A-Z, tanpa paginasi.
  trainings: PublicCategoryTraining[];
};

export function publicCountInclude(now: Date) {
  return {
    _count: { select: { trainings: { where: { training: publicTrainingWhere(now) } } } },
    image: true,
  } satisfies Prisma.CategoryInclude;
}

type PublicCountRow = Prisma.CategoryGetPayload<{ include: ReturnType<typeof publicCountInclude> }>;

export function toPublicCategory(category: PublicCountRow): PublicCategory {
  return {
    slug: category.slug,
    name: category.name,
    description: category.description,
    summary: category.summary,
    icon: category.icon,
    featured: category.featured,
    image: toPublicImage(activeMediaDto(category.image)),
    trainingCount: category._count.trainings,
  };
}

// Potong teks ke maks n karakter tanpa memenggal kata (untuk fallback meta description).
const META_DESCRIPTION_MAX = 160;
function clampText(value: string, max: number): string {
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (trimmed.length <= max) return trimmed;
  const cut = trimmed.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd();
}

// Pecah teks biasa menjadi paragraf: pemisah = satu baris kosong atau lebih.
function toParagraphs(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
    .filter((paragraph) => paragraph.length > 0);
}

// Kategori tanpa pelatihan tayang tidak tampil di publik (daftar, filter, landing, menu); datanya
// tetap ada di admin. Dengan satu pelatihan satu kategori, banyak kategori referensi kosong.
export function nonEmptyPublicCategoryWhere(now: Date) {
  return { deletedAt: null, trainings: { some: { training: publicTrainingWhere(now) } } } satisfies Prisma.CategoryWhereInput;
}

export async function listPublicCategories(now = new Date()): Promise<PublicCategory[]> {
  const rows = await getDb().category.findMany({
    where: nonEmptyPublicCategoryWhere(now),
    include: publicCountInclude(now),
    orderBy: [{ order: "asc" }, { name: "asc" }],
  });
  return rows.map(toPublicCategory);
}

export async function getPublicCategory(slug: string, now = new Date()): Promise<PublicCategoryDetail | null> {
  const category = await getDb().category.findFirst({
    where: { slug, ...nonEmptyPublicCategoryWhere(now) },
    include: {
      ...publicCountInclude(now),
      images: { orderBy: { order: "asc" }, include: { media: true } },
    },
  });
  if (!category) return null;

  const base = toPublicCategory(category);
  const paragraphs = toParagraphs(category.description);
  const metaDescription = category.summary?.trim()
    ? category.summary.trim()
    : paragraphs.length > 0
      ? clampText(paragraphs.join(" "), META_DESCRIPTION_MAX)
      : "";
  // Cover alt: coverAlt eksplisit, lalu alt Media (dipakai FE lewat image.alt kalau coverAlt null).
  const images = category.images.flatMap((link) => {
    const image = toPublicImage(activeMediaDto(link.media));
    return image ? [image] : [];
  });

  // Pelatihan tayang di kategori ini, urut A-Z, tanpa paginasi.
  const trainingRows = await getDb().training.findMany({
    where: { ...publicTrainingWhere(now), categories: { some: { categoryId: category.id } } },
    select: { slug: true, title: true, types: true },
    orderBy: [{ title: "asc" }, { id: "asc" }],
  });

  return {
    ...base,
    metaDescription,
    coverAlt: category.coverAlt ?? base.image?.alt ?? null,
    descriptionParagraphs: paragraphs,
    audience: readCategoryAudience(category.audience),
    audienceSource: category.audienceSource === "auto" ? "auto" : "manual",
    images,
    trainings: trainingRows.map((row) => ({ slug: row.slug, title: row.title, types: row.types })),
  };
}
