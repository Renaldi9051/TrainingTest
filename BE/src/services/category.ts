import type { Category, Media, Prisma } from "@/generated/prisma/client";
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
  CategoryCreateInput,
  CategoryDeleteQuery,
  CategoryListQuery,
  CategoryUpdateInput,
} from "@/lib/validators/category";
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
const FIELDS = ["slug", "name", "description", "icon", "featured", "order", "imageId", "keywords"] as const;

export type CategoryDto = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  order: number;
  featured: boolean;
  imageId: string | null;
  image: MediaDto | null;
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

const adminInclude = { ...adminTrainingCount, image: true } satisfies Prisma.CategoryInclude;

type CategoryWithCount = Category & { _count: { trainings: number }; image: Media | null };

function toDto(category: CategoryWithCount): CategoryDto {
  return {
    id: category.id,
    slug: category.slug,
    name: category.name,
    description: category.description,
    icon: category.icon,
    order: category.order,
    featured: category.featured,
    imageId: category.imageId,
    image: activeMediaDto(category.image),
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

export async function createCategory(input: CategoryCreateInput, userId: string): Promise<CategoryDto> {
  // Slug ditulis admin: bentrok = 409. Slug otomatis dari nama: cari sufiks yang kosong.
  const slug = input.slug ?? (await nextAvailableSlug(slugLookup, slugify(input.name) || "kategori"));
  if (input.slug) await assertSlugAvailable(slugLookup, slug);
  await assertMediaRefs([{ field: "imageId", mediaId: input.imageId, kind: "image", requireAlt: true }]);

  const last = await getDb().category.aggregate({ where: { deletedAt: null }, _max: { order: true } });
  const order = (last._max.order ?? -1) + 1;

  const created = await withSlugConflict(() =>
    getDb().$transaction(async (tx) => {
      const category = await tx.category.create({
        data: {
          slug,
          name: input.name,
          description: input.description,
          icon: input.icon,
          featured: input.featured,
          imageId: input.imageId,
          keywords: input.keywords,
          order,
          updatedById: userId,
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
          diff: diffFields(null, category, FIELDS) as Prisma.InputJsonValue,
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
  await assertMediaRefs([{ field: "imageId", mediaId: input.imageId, kind: "image", requireAlt: true }]);

  const data: Prisma.CategoryUncheckedUpdateInput = { updatedById: userId };
  if (input.name !== undefined) data.name = input.name;
  if (slugChanged) data.slug = input.slug;
  if (input.description !== undefined) data.description = input.description;
  if (input.icon !== undefined) data.icon = input.icon;
  if (input.featured !== undefined) data.featured = input.featured;
  if (input.imageId !== undefined) data.imageId = input.imageId;
  if (input.keywords !== undefined) data.keywords = input.keywords;

  const updated = await withSlugConflict(() =>
    getDb().$transaction(async (tx) => {
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
          diff: diffFields(before, category, FIELDS) as Prisma.InputJsonValue,
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
  icon: string | null;
  featured: boolean;
  // Gambar kategori (foto landing kategori); null kalau kosong atau media di Sampah.
  image: PublicImage | null;
  trainingCount: number;
};

export function publicCountInclude(now: Date) {
  return {
    _count: { select: { trainings: { where: { training: publicTrainingWhere(now) } } } },
    image: true,
  } satisfies Prisma.CategoryInclude;
}

export function toPublicCategory(category: CategoryWithCount): PublicCategory {
  return {
    slug: category.slug,
    name: category.name,
    description: category.description,
    icon: category.icon,
    featured: category.featured,
    image: toPublicImage(activeMediaDto(category.image)),
    trainingCount: category._count.trainings,
  };
}

export async function listPublicCategories(now = new Date()): Promise<PublicCategory[]> {
  const rows = await getDb().category.findMany({
    where: { deletedAt: null },
    include: publicCountInclude(now),
    orderBy: [{ order: "asc" }, { name: "asc" }],
  });
  return rows.map(toPublicCategory);
}

export async function getPublicCategory(slug: string, now = new Date()): Promise<PublicCategory | null> {
  const category = await getDb().category.findFirst({
    where: { slug, deletedAt: null },
    include: publicCountInclude(now),
  });
  return category ? toPublicCategory(category) : null;
}
