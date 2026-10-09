import { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import { listMeta, type ListMeta } from "@/lib/list-query";
import { renderRichText } from "@/lib/rich-text";
import { normalizeSearchText, toPrefixTsQuery, TYPO_SIMILARITY_THRESHOLD } from "@/lib/search";
import { slugSchema } from "@/lib/slug";
import { appToday, toDateString } from "@/lib/time";
import type { PublicTrainingQuery } from "@/lib/validators/training";
import { getMediaMap, toMediaDto, toPublicImage, type PublicImage } from "@/services/media";
import { scheduleDisplayStatus, type PublicScheduleStatus } from "@/services/schedule-status";
import { parseSeo } from "@/services/training";
import { publicTrainingWhere } from "@/services/training-visibility";

// ===== DTO =====

export type PublicCategoryRef = { slug: string; name: string };

export type PublicTrainingCard = {
  slug: string;
  title: string;
  summary: string | null;
  duration: string | null;
  method: string | null;
  types: string[];
  cover: PublicImage | null;
  categories: PublicCategoryRef[];
  publishedAt: Date;
};

export type PublicTrainingSchedule = {
  id: string;
  startDate: string;
  endDate: string;
  city: string | null;
  venue: string | null;
  method: string;
  // null kalau pelatihan menyembunyikan harga (showPrice false) atau harga belum diisi.
  price: number | null;
  status: PublicScheduleStatus;
};

export type PublicTrainingDetail = PublicTrainingCard & {
  bodyHtml: string | null;
  objectivesHtml: string | null;
  syllabusHtml: string | null;
  audienceHtml: string | null;
  facilitiesHtml: string | null;
  showPrice: boolean;
  // null kalau showPrice false: harga tidak pernah dikirim ke publik.
  priceText: string | null;
  seo: { title: string; description: string; ogImage: PublicImage | null };
  schedules: PublicTrainingSchedule[];
  related: PublicTrainingCard[];
  updatedAt: Date;
};

const cardInclude = {
  cover: true,
  categories: {
    include: { category: { select: { slug: true, name: true, order: true, deletedAt: true } } },
  },
} satisfies Prisma.TrainingInclude;

type CardRow = Prisma.TrainingGetPayload<{ include: typeof cardInclude }>;

function toCard(row: CardRow): PublicTrainingCard {
  return {
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    duration: row.duration,
    method: row.method,
    types: row.types,
    cover: row.cover && row.cover.deletedAt === null ? toPublicImage(toMediaDto(row.cover)) : null,
    categories: row.categories
      .map((link) => link.category)
      .filter((category) => category.deletedAt === null)
      .sort((a, b) => a.order - b.order)
      .map(({ slug, name }) => ({ slug, name })),
    // publicTrainingWhere menjamin publishedAt terisi.
    publishedAt: row.publishedAt ?? row.createdAt,
  };
}

// ===== Katalog =====

export type PublicCatalog = { items: PublicTrainingCard[]; meta: ListMeta & { q: string | null } };

type Sort = "relevan" | "terbaru" | "az";

// Filter & urutan di SQL (search butuh tsvector/pg_trgm), lalu baris lengkap diambil lewat Prisma
// berdasarkan id dengan urutan yang sama.
function catalogWhere(query: PublicTrainingQuery, now: Date, tsQuery: string | null, normalized: string) {
  const categorySlugs = query.kategori.filter((slug) => slugSchema.safeParse(slug).success);
  const conditions: Prisma.Sql[] = [
    Prisma.sql`t."deletedAt" IS NULL`,
    Prisma.sql`t."status" = 'PUBLISHED'`,
    Prisma.sql`t."publishedAt" <= ${now}`,
  ];
  if (categorySlugs.length > 0) {
    conditions.push(Prisma.sql`EXISTS (
      SELECT 1 FROM "TrainingCategory" tc JOIN "Category" c ON c."id" = tc."categoryId"
      WHERE tc."trainingId" = t."id" AND c."deletedAt" IS NULL AND c."slug" = ANY(${categorySlugs}::text[])
    )`);
  }
  if (query.metode) conditions.push(Prisma.sql`t."method" = ${query.metode}::"TrainingMethod"`);
  if (query.tipe) conditions.push(Prisma.sql`${query.tipe}::"TrainingType" = ANY(t."types")`);
  if (tsQuery) {
    conditions.push(Prisma.sql`(
      t."searchVector" @@ to_tsquery('public.simple_unaccent', ${tsQuery})
      OR ${normalized} <% t."searchTitle"
    )`);
  }
  return Prisma.join(conditions, " AND ");
}

function catalogOrder(sort: Sort, tsQuery: string | null, normalized: string): Prisma.Sql {
  if (sort === "az") return Prisma.sql`lower(t."title") ASC, t."id" ASC`;
  if (sort === "relevan" && tsQuery) {
    return Prisma.sql`(
      ts_rank(t."searchVector", to_tsquery('public.simple_unaccent', ${tsQuery})) * 2
      + word_similarity(${normalized}, t."searchTitle")
    ) DESC, t."publishedAt" DESC, t."id" ASC`;
  }
  return Prisma.sql`t."publishedAt" DESC, t."id" ASC`;
}

export async function listPublicTrainings(query: PublicTrainingQuery, now = new Date()): Promise<PublicCatalog> {
  const tsQuery = query.q ? toPrefixTsQuery(query.q) : null;
  const normalized = query.q ? normalizeSearchText(query.q) : "";
  const sort: Sort = query.urut ?? (tsQuery ? "relevan" : "terbaru");
  const where = catalogWhere(query, now, tsQuery, normalized);
  const order = catalogOrder(sort, tsQuery, normalized);
  const take = query.per;
  const skip = (query.hal - 1) * take;

  const db = getDb();
  const rows = await db.$transaction(async (tx) => {
    // Ambang typo hanya untuk transaksi ini (SET LOCAL).
    if (tsQuery) {
      await tx.$executeRaw`SELECT set_config('pg_trgm.word_similarity_threshold', ${String(TYPO_SIMILARITY_THRESHOLD)}, true)`;
    }
    return tx.$queryRaw<{ id: string; total: bigint }[]>`
      SELECT t."id", count(*) OVER() AS total
      FROM "Training" t
      WHERE ${where}
      ORDER BY ${order}
      LIMIT ${take} OFFSET ${skip}
    `;
  });

  let total = rows[0] ? Number(rows[0].total) : 0;
  if (rows.length === 0 && query.hal > 1) {
    // Halaman di luar jangkauan: tetap kirim total supaya FE bisa menampilkan paginasi.
    const counted = await db.$transaction(async (tx) => {
      if (tsQuery) {
        await tx.$executeRaw`SELECT set_config('pg_trgm.word_similarity_threshold', ${String(TYPO_SIMILARITY_THRESHOLD)}, true)`;
      }
      return tx.$queryRaw<{ total: bigint }[]>`SELECT count(*) AS total FROM "Training" t WHERE ${where}`;
    });
    total = Number(counted[0]?.total ?? 0);
  }

  const ids = rows.map((row) => row.id);
  const records = ids.length
    ? await db.training.findMany({ where: { id: { in: ids } }, include: cardInclude })
    : [];
  const byId = new Map(records.map((record) => [record.id, record]));
  const items = ids.flatMap((id) => {
    const record = byId.get(id);
    return record ? [toCard(record)] : [];
  });

  return { items, meta: { ...listMeta(query.hal, take, total), q: query.q ?? null } };
}

// ===== Detail =====

const SCHEDULES_ON_DETAIL = 12;
const RELATED_COUNT = 4;

async function relatedTrainings(row: CardRow, now: Date): Promise<PublicTrainingCard[]> {
  const categoryIds = row.categories
    .filter((link) => link.category.deletedAt === null)
    .map((link) => link.categoryId);
  if (categoryIds.length === 0) return [];
  const related = await getDb().training.findMany({
    where: {
      ...publicTrainingWhere(now),
      id: { not: row.id },
      categories: { some: { categoryId: { in: categoryIds } } },
    },
    include: cardInclude,
    orderBy: [{ publishedAt: "desc" }, { id: "asc" }],
    take: RELATED_COUNT,
  });
  return related.map(toCard);
}

async function buildDetail(
  row: CardRow & { schedules: Prisma.ScheduleGetPayload<object>[] },
  now: Date,
): Promise<PublicTrainingDetail> {
  const seo = parseSeo(row.seo);
  const [media, related] = await Promise.all([getMediaMap([seo.ogImageId]), relatedTrainings(row, now)]);
  const today = appToday(now);
  const card = toCard(row);
  return {
    ...card,
    bodyHtml: renderRichText(row.body),
    objectivesHtml: renderRichText(row.objectives),
    syllabusHtml: renderRichText(row.syllabus),
    audienceHtml: renderRichText(row.audience),
    facilitiesHtml: renderRichText(row.facilities),
    showPrice: row.showPrice,
    priceText: row.showPrice ? row.priceText : null,
    seo: {
      title: seo.title,
      description: seo.description,
      ogImage: toPublicImage(seo.ogImageId ? media.get(seo.ogImageId) : null) ?? card.cover,
    },
    schedules: row.schedules.map((schedule) => ({
      id: schedule.id,
      startDate: toDateString(schedule.startDate),
      endDate: toDateString(schedule.endDate),
      city: schedule.city,
      venue: schedule.venue,
      method: schedule.method,
      price: row.showPrice ? schedule.price : null,
      status: scheduleDisplayStatus(schedule, today),
    })),
    related,
    updatedAt: row.updatedAt,
  };
}

function detailInclude(now: Date) {
  return {
    ...cardInclude,
    schedules: {
      where: { deletedAt: null, endDate: { gte: appToday(now) } },
      orderBy: [{ startDate: "asc" as const }, { id: "asc" as const }],
      take: SCHEDULES_ON_DETAIL,
    },
  } satisfies Prisma.TrainingInclude;
}

export async function getPublicTraining(slug: string, now = new Date()): Promise<PublicTrainingDetail | null> {
  const row = await getDb().training.findFirst({
    where: { slug, ...publicTrainingWhere(now) },
    include: detailInclude(now),
  });
  return row ? buildDetail(row, now) : null;
}

// Pratinjau admin (draft mode): bentuk sama dengan detail publik, tanpa syarat tayang.
export async function getTrainingPreview(slug: string, now = new Date()): Promise<PublicTrainingDetail | null> {
  const row = await getDb().training.findFirst({
    where: { slug, deletedAt: null },
    include: detailInclude(now),
  });
  if (!row) return null;
  return buildDetail({ ...row, publishedAt: row.publishedAt ?? now }, now);
}

// Slug pelatihan terbaru untuk generateStaticParams FE.
export async function listPublicTrainingSlugs(limit: number, now = new Date()): Promise<string[]> {
  const rows = await getDb().training.findMany({
    where: publicTrainingWhere(now),
    select: { slug: true },
    orderBy: [{ publishedAt: "desc" }, { id: "asc" }],
    take: limit,
  });
  return rows.map((row) => row.slug);
}
