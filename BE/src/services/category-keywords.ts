import { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import { HttpError } from "@/lib/http";
import { revalidateEntity } from "@/lib/revalidate-map";
import { wholeWordRegex } from "@/lib/search";
import type { KeywordLinkInput } from "@/lib/validators/category";
import { AuditAction, writeAudit } from "@/services/audit";
import { findActiveCategory } from "@/services/category";

// "Pelatihan yang cocok": pelatihan (belum dihapus, draft maupun tayang) yang judulnya memuat salah
// satu kata kunci kategori sebagai kata/frasa utuh tapi belum tertaut ke kategori itu. Admin memilih
// sendiri mana yang ditautkan; tidak ada penautan otomatis saat pelatihan disimpan.

export const KEYWORD_MATCH_LIMIT = 200;

export type KeywordMatch = {
  id: string;
  slug: string;
  title: string;
  status: "DRAFT" | "PUBLISHED";
  categories: { id: string; name: string }[];
};

export type KeywordMatches = {
  keywords: string[];
  // Belum tertaut, urut judul; paling banyak KEYWORD_MATCH_LIMIT.
  items: KeywordMatch[];
  // Jumlah semua yang belum tertaut (bisa lebih dari items).
  total: number;
  // Cocok dan sudah tertaut.
  linkedCount: number;
};

type MatchRow = { id: string; linked: boolean };

// Id pelatihan (belum dihapus) yang judulnya cocok dengan salah satu kata kunci, plus status tautan
// ke kategori. Pola regex dibangun di kode dan selalu dikirim sebagai parameter.
export async function findKeywordMatchIds(categoryId: string, keywords: readonly string[]): Promise<MatchRow[]> {
  const patterns = keywords.map(wholeWordRegex);
  if (patterns.length === 0) return [];
  return getDb().$queryRaw<MatchRow[]>(Prisma.sql`
    SELECT t."id",
      EXISTS (
        SELECT 1 FROM "TrainingCategory" tc WHERE tc."trainingId" = t."id" AND tc."categoryId" = ${categoryId}::uuid
      ) AS "linked"
    FROM "Training" t
    WHERE t."deletedAt" IS NULL
      AND EXISTS (SELECT 1 FROM unnest(${patterns}::text[]) AS p("pattern") WHERE t."searchTitle" ~ p."pattern")
    ORDER BY t."searchTitle", t."id"
  `);
}

export async function listKeywordMatches(categoryId: string): Promise<KeywordMatches> {
  const category = await findActiveCategory(categoryId);
  const rows = await findKeywordMatchIds(categoryId, category.keywords);
  const unlinked = rows.filter((row) => !row.linked).map((row) => row.id);
  const pageIds = unlinked.slice(0, KEYWORD_MATCH_LIMIT);
  const trainings =
    pageIds.length === 0
      ? []
      : await getDb().training.findMany({
          where: { id: { in: pageIds } },
          select: {
            id: true,
            slug: true,
            title: true,
            status: true,
            categories: {
              where: { category: { deletedAt: null } },
              select: { category: { select: { id: true, name: true } } },
            },
          },
        });
  const byId = new Map(trainings.map((training) => [training.id, training]));
  const items = pageIds.flatMap((id) => {
    const training = byId.get(id);
    if (!training) return [];
    return [
      {
        id: training.id,
        slug: training.slug,
        title: training.title,
        status: training.status,
        categories: training.categories
          .map((link) => link.category)
          .sort((a, b) => a.name.localeCompare(b.name, "id")),
      },
    ];
  });
  return { keywords: category.keywords, items, total: unlinked.length, linkedCount: rows.length - unlinked.length };
}

// Tautkan pelatihan terpilih ke kategori (hanya menambah). Pelatihan ditandai diubah admin
// (updatedById), sama seperti aksi massal pelatihan, supaya seed katalog referensi berikutnya tidak
// mengembalikan tautannya ke data sumber.
export async function linkKeywordMatches(
  categoryId: string,
  input: KeywordLinkInput,
  userId: string,
): Promise<{ linked: number }> {
  const category = await findActiveCategory(categoryId);
  const db = getDb();
  const trainings = await db.training.findMany({
    where: { id: { in: input.trainingIds }, deletedAt: null },
    select: { id: true, slug: true },
  });
  if (trainings.length !== input.trainingIds.length) {
    throw new HttpError(422, "VALIDATION_ERROR", "Sebagian pelatihan tidak ditemukan atau sudah dihapus.", {
      trainingIds: ["Muat ulang daftar lalu pilih lagi."],
    });
  }
  const ids = trainings.map((training) => training.id);
  const linked = await db.$transaction(async (tx) => {
    const created = await tx.trainingCategory.createMany({
      data: ids.map((trainingId) => ({ trainingId, categoryId })),
      skipDuplicates: true,
    });
    await tx.training.updateMany({ where: { id: { in: ids } }, data: { updatedById: userId } });
    await writeAudit(
      {
        userId,
        action: AuditAction.UPDATE,
        entity: "Category",
        entityId: categoryId,
        diff: { linkedTrainings: ids, source: "keywords" },
      },
      tx,
    );
    return created.count;
  });
  await revalidateEntity([
    { entity: "Category", slugs: [category.slug] },
    { entity: "Training", slugs: trainings.map((training) => training.slug) },
  ]);
  return { linked };
}
