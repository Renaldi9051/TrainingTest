import type { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import { HttpError } from "@/lib/http";
import { revalidateEntity } from "@/lib/revalidate-map";
import { assertSlugAvailable, nextAvailableSlug, slugify, type SlugLookup, withSlugConflict } from "@/lib/slug";
import type { ArticleCategoryCreateInput, ArticleCategoryUpdateInput } from "@/lib/validators/article";
import { AuditAction, diffFields, writeAudit } from "@/services/audit";
import { nextOrder } from "@/services/reorder";

// Kategori artikel hanya dipakai sebagai filter ?kategori= di /artikel (tidak punya halaman
// sendiri), jadi ganti slug tidak membuat redirect.

const ENTITY = "ArticleCategory";
const AUDIT_FIELDS = ["name", "slug"] as const;

export type ArticleCategoryDto = {
  id: string;
  slug: string;
  name: string;
  order: number;
  // Jumlah artikel (semua status, belum dihapus).
  articleCount: number;
};

const include = {
  _count: { select: { articles: { where: { deletedAt: null } } } },
} satisfies Prisma.ArticleCategoryInclude;

type Row = Prisma.ArticleCategoryGetPayload<{ include: typeof include }>;

function toDto(row: Row): ArticleCategoryDto {
  return { id: row.id, slug: row.slug, name: row.name, order: row.order, articleCount: row._count.articles };
}

export const articleCategorySlugLookup: SlugLookup = (args) => getDb().articleCategory.findFirst(args);

async function findActive(id: string): Promise<Row> {
  const row = await getDb().articleCategory.findFirst({ where: { id, deletedAt: null }, include });
  if (!row) throw new HttpError(404, "NOT_FOUND", "Kategori artikel tidak ditemukan.");
  return row;
}

export async function listArticleCategories(): Promise<ArticleCategoryDto[]> {
  const rows = await getDb().articleCategory.findMany({
    where: { deletedAt: null },
    include,
    orderBy: [{ order: "asc" }, { name: "asc" }],
  });
  return rows.map(toDto);
}

export async function createArticleCategory(input: ArticleCategoryCreateInput, userId: string): Promise<ArticleCategoryDto> {
  const slug = input.slug ?? (await nextAvailableSlug(articleCategorySlugLookup, slugify(input.name) || "kategori"));
  if (input.slug) await assertSlugAvailable(articleCategorySlugLookup, slug);
  const db = getDb();
  const order = await nextOrder(db.articleCategory);
  const created = await withSlugConflict(() =>
    db.$transaction(async (tx) => {
      const row = await tx.articleCategory.create({
        data: { name: input.name, slug, order, updatedById: userId },
        include,
      });
      await writeAudit(
        {
          userId,
          action: AuditAction.CREATE,
          entity: ENTITY,
          entityId: row.id,
          diff: diffFields(null, row, AUDIT_FIELDS) as Prisma.InputJsonValue,
        },
        tx,
      );
      return row;
    }),
  );
  await revalidateEntity({ entity: "ArticleCategory" });
  return toDto(created);
}

export async function updateArticleCategory(
  id: string,
  input: ArticleCategoryUpdateInput,
  userId: string,
): Promise<ArticleCategoryDto> {
  const before = await findActive(id);
  const slugChanged = input.slug !== undefined && input.slug !== before.slug;
  if (slugChanged && input.slug) await assertSlugAvailable(articleCategorySlugLookup, input.slug, id);
  const updated = await withSlugConflict(() =>
    getDb().$transaction(async (tx) => {
      const row = await tx.articleCategory.update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(slugChanged ? { slug: input.slug } : {}),
          updatedById: userId,
        },
        include,
      });
      await writeAudit(
        {
          userId,
          action: AuditAction.UPDATE,
          entity: ENTITY,
          entityId: id,
          diff: diffFields(before, row, AUDIT_FIELDS) as Prisma.InputJsonValue,
        },
        tx,
      );
      return row;
    }),
  );
  await revalidateEntity({ entity: "ArticleCategory" });
  return toDto(updated);
}

// Kategori yang masih dipakai artikel aktif tidak boleh dihapus (artikel wajib punya kategori).
export async function deleteArticleCategory(id: string, userId: string): Promise<void> {
  const row = await findActive(id);
  if (row._count.articles > 0) {
    throw new HttpError(
      409,
      "CATEGORY_IN_USE",
      `Kategori masih dipakai ${row._count.articles} artikel. Pindahkan artikelnya ke kategori lain dulu.`,
    );
  }
  await getDb().$transaction(async (tx) => {
    await tx.articleCategory.update({ where: { id }, data: { deletedAt: new Date(), updatedById: userId } });
    await writeAudit({ userId, action: AuditAction.DELETE, entity: ENTITY, entityId: id, diff: { slug: row.slug } }, tx);
  });
  await revalidateEntity({ entity: "ArticleCategory" });
}
