import type { Category, Prisma } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import { HttpError } from "@/lib/http";
import { listMeta, pagination, type ListMeta } from "@/lib/list-query";
import { revalidateTags, RevalidateTag, tags } from "@/lib/revalidate";
import {
  assertSlugAvailable,
  nextAvailableSlug,
  slugify,
  type SlugLookup,
  withSlugConflict,
} from "@/lib/slug";
import type {
  CategoryCreateInput,
  CategoryListQuery,
  CategoryUpdateInput,
} from "@/lib/validators/category";
import type { ReorderInput, RestoreInput } from "@/lib/validators/common";
import { AuditAction, diffFields, writeAudit } from "@/services/audit";
import { publicPath, recordSlugRedirect, releaseRedirectPath } from "@/services/redirect";
import { publicTrainingWhere } from "@/services/training-visibility";

const ENTITY = "Category";
const FIELDS = ["slug", "name", "description", "icon", "featured", "order"] as const;

export type CategoryDto = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  order: number;
  featured: boolean;
  trainingCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export type CategoryOption = { id: string; slug: string; name: string };

// Jumlah pelatihan yang belum dihapus (draft + published) per kategori, untuk admin.
const adminTrainingCount = {
  _count: { select: { trainings: { where: { training: { deletedAt: null } } } } },
} satisfies Prisma.CategoryInclude;

type CategoryWithCount = Category & { _count: { trainings: number } };

function toDto(category: CategoryWithCount): CategoryDto {
  return {
    id: category.id,
    slug: category.slug,
    name: category.name,
    description: category.description,
    icon: category.icon,
    order: category.order,
    featured: category.featured,
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
  const [rows, total] = await Promise.all([
    db.category.findMany({
      where,
      include: adminTrainingCount,
      orderBy: [{ [query.sort.field]: query.sort.direction }, { name: "asc" }],
      ...pagination(query.page, query.pageSize),
    }),
    db.category.count({ where }),
  ]);
  return { items: rows.map(toDto), meta: listMeta(query.page, query.pageSize, total) };
}

// Semua kategori aktif (untuk pilihan di form pelatihan dan mode urutkan).
export async function listCategoryOptions(): Promise<CategoryOption[]> {
  return getDb().category.findMany({
    where: { deletedAt: null },
    select: { id: true, slug: true, name: true },
    orderBy: [{ order: "asc" }, { name: "asc" }],
  });
}

async function findActive(id: string): Promise<CategoryWithCount> {
  const category = await getDb().category.findFirst({
    where: { id, deletedAt: null },
    include: adminTrainingCount,
  });
  if (!category) throw new HttpError(404, "NOT_FOUND", "Kategori tidak ditemukan.");
  return category;
}

export async function getCategory(id: string): Promise<CategoryDto> {
  return toDto(await findActive(id));
}

function categoryTags(...slugs: (string | null | undefined)[]): string[] {
  return tags(
    RevalidateTag.CATEGORIES,
    RevalidateTag.TRAININGS,
    ...slugs.map((slug) => (slug ? RevalidateTag.category(slug) : null)),
  );
}

export async function createCategory(input: CategoryCreateInput, userId: string): Promise<CategoryDto> {
  // Slug ditulis admin: bentrok = 409. Slug otomatis dari nama: cari sufiks yang kosong.
  const slug = input.slug ?? (await nextAvailableSlug(slugLookup, slugify(input.name) || "kategori"));
  if (input.slug) await assertSlugAvailable(slugLookup, slug);

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
          order,
          updatedById: userId,
        },
        include: adminTrainingCount,
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

  await revalidateTags(categoryTags(created.slug));
  return toDto(created);
}

export async function updateCategory(
  id: string,
  input: CategoryUpdateInput,
  userId: string,
): Promise<CategoryDto> {
  const before = await findActive(id);
  const slugChanged = input.slug !== undefined && input.slug !== before.slug;
  if (slugChanged && input.slug) await assertSlugAvailable(slugLookup, input.slug, id);

  const data: Prisma.CategoryUncheckedUpdateInput = { updatedById: userId };
  if (input.name !== undefined) data.name = input.name;
  if (slugChanged) data.slug = input.slug;
  if (input.description !== undefined) data.description = input.description;
  if (input.icon !== undefined) data.icon = input.icon;
  if (input.featured !== undefined) data.featured = input.featured;

  const updated = await withSlugConflict(() =>
    getDb().$transaction(async (tx) => {
      const category = await tx.category.update({ where: { id }, data, include: adminTrainingCount });
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

  await revalidateTags(categoryTags(updated.slug, slugChanged ? before.slug : null));
  return toDto(updated);
}

// Kategori yang masih dipakai pelatihan aktif tidak boleh dihapus, supaya tidak ada pelatihan
// yang kehilangan kategori di halaman publik. Pindahkan dulu lewat bulk action pelatihan.
export async function deleteCategory(id: string, userId: string): Promise<void> {
  const category = await findActive(id);
  if (category._count.trainings > 0) {
    throw new HttpError(
      409,
      "CATEGORY_IN_USE",
      `Kategori masih dipakai ${category._count.trainings} pelatihan. Pindahkan pelatihan tersebut ke kategori lain dulu.`,
      undefined,
      { trainingCount: category._count.trainings },
    );
  }
  await getDb().$transaction(async (tx) => {
    await tx.category.update({ where: { id }, data: { deletedAt: new Date(), updatedById: userId } });
    await writeAudit(
      { userId, action: AuditAction.DELETE, entity: ENTITY, entityId: id, diff: { slug: category.slug } },
      tx,
    );
  });
  await revalidateTags(categoryTags(category.slug));
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
        include: adminTrainingCount,
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
  await revalidateTags(categoryTags(restored.slug));
  return toDto(restored);
}

// Urutan semua kategori aktif. Daftar id harus lengkap.
export async function reorderCategories(input: ReorderInput, userId: string): Promise<void> {
  const db = getDb();
  const active = await db.category.findMany({ where: { deletedAt: null }, select: { id: true } });
  const activeIds = new Set(active.map((row) => row.id));
  if (activeIds.size !== input.ids.length || !input.ids.every((id) => activeIds.has(id))) {
    throw new HttpError(422, "VALIDATION_ERROR", "Urutan harus berisi semua kategori aktif.", {
      ids: ["Daftar kategori tidak lengkap atau berisi kategori yang sudah dihapus."],
    });
  }
  await db.$transaction(async (tx) => {
    for (const [order, id] of input.ids.entries()) {
      await tx.category.update({ where: { id }, data: { order, updatedById: userId } });
    }
    await writeAudit(
      { userId, action: AuditAction.REORDER, entity: ENTITY, diff: { ids: input.ids } },
      tx,
    );
  });
  await revalidateTags([RevalidateTag.CATEGORIES]);
}

// ===== Publik =====

export type PublicCategory = {
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  featured: boolean;
  trainingCount: number;
};

function publicCountInclude(now: Date) {
  return {
    _count: { select: { trainings: { where: { training: publicTrainingWhere(now) } } } },
  } satisfies Prisma.CategoryInclude;
}

function toPublic(category: CategoryWithCount): PublicCategory {
  return {
    slug: category.slug,
    name: category.name,
    description: category.description,
    icon: category.icon,
    featured: category.featured,
    trainingCount: category._count.trainings,
  };
}

export async function listPublicCategories(now = new Date()): Promise<PublicCategory[]> {
  const rows = await getDb().category.findMany({
    where: { deletedAt: null },
    include: publicCountInclude(now),
    orderBy: [{ order: "asc" }, { name: "asc" }],
  });
  return rows.map(toPublic);
}

export async function getPublicCategory(slug: string, now = new Date()): Promise<PublicCategory | null> {
  const category = await getDb().category.findFirst({
    where: { slug, deletedAt: null },
    include: publicCountInclude(now),
  });
  return category ? toPublic(category) : null;
}
