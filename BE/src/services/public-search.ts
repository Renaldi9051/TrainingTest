import { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import { HttpError } from "@/lib/http";
import { getPublicSearchRateLimiter, ipRateLimitKey, type RateLimiter, type UnknownIpMode } from "@/lib/rate-limit";
import { likeContainsPattern, TYPO_SIMILARITY_THRESHOLD } from "@/lib/search";
import { anyColumnLike, startsFirst, startsWithText, trainingTextSearch } from "@/lib/search-sql";

// Search publik untuk palette Ctrl/Cmd+K (DESIGN.md 7, PRD API /public/search): pelatihan, kategori,
// layanan. Hanya yang tampil publik, aturan sama dengan katalog: pelatihan PUBLISHED, tidak di Sampah,
// waktu tayang sudah lewat (draf & terjadwal tidak bocor); layanan PUBLISHED, tidak di Sampah;
// kategori tidak di Sampah dan punya minimal satu pelatihan tayang (jumlahnya hanya menghitung
// pelatihan tayang). Respons hanya slug, judul, dan keterangan (tanpa id/status).

export const PUBLIC_SEARCH_LIMITS = { trainings: 6, categories: 4, services: 4 } as const;

export type PublicSearchGroup = keyof typeof PUBLIC_SEARCH_LIMITS;

export type PublicSearchItem = {
  slug: string;
  title: string;
  // Pelatihan: kategori utama; layanan: ringkasan; kategori: null.
  meta: string | null;
  // Khusus kategori: jumlah pelatihan yang tampil publik.
  trainingCount?: number;
};

export type PublicSearchResult = {
  q: string;
  groups: { group: PublicSearchGroup; items: PublicSearchItem[] }[];
};

export type PublicSearchMeta = { ip: string; unknownIpMode?: UnknownIpMode };

// Pelatihan yang tampil publik (alias t), sama dengan publicTrainingWhere.
const publicTraining = (now: Date) =>
  Prisma.sql`t."deletedAt" IS NULL AND t."status" = 'PUBLISHED' AND t."publishedAt" IS NOT NULL AND t."publishedAt" <= ${now}`;

async function searchTrainings(query: string, now: Date): Promise<PublicSearchItem[]> {
  const { match, rank } = trainingTextSearch(query);
  return getDb().$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('pg_trgm.word_similarity_threshold', ${String(TYPO_SIMILARITY_THRESHOLD)}, true)`;
    return tx.$queryRaw<PublicSearchItem[]>`
      SELECT t."slug", t."title",
        (SELECT c."name" FROM "TrainingCategory" tc JOIN "Category" c ON c."id" = tc."categoryId"
          WHERE tc."trainingId" = t."id" AND c."deletedAt" IS NULL
          ORDER BY c."order" ASC, c."name" ASC LIMIT 1) AS "meta"
      FROM "Training" t
      WHERE ${publicTraining(now)} AND ${match}
      ORDER BY (${rank}) DESC, t."publishedAt" DESC, t."id" ASC
      LIMIT ${PUBLIC_SEARCH_LIMITS.trainings}
    `;
  });
}

async function searchCategories(query: string, now: Date): Promise<PublicSearchItem[]> {
  // Jumlah hanya pelatihan tayang; kategori tanpa pelatihan tayang (mis. hanya berisi draf) tidak tampil.
  const rows = await getDb().$queryRaw<{ slug: string; title: string; trainingCount: number }[]>`
    SELECT matched."slug", matched."title", matched."trainingCount"
    FROM (
      SELECT c."slug", c."name" AS "title", c."order", ${startsWithText('c."name"', query)} AS "starts",
        (SELECT count(*) FROM "TrainingCategory" tc JOIN "Training" t ON t."id" = tc."trainingId"
          WHERE tc."categoryId" = c."id" AND ${publicTraining(now)})::int AS "trainingCount"
      FROM "Category" c
      WHERE c."deletedAt" IS NULL AND (${anyColumnLike(['c."name"', 'c."slug"', 'c."description"'], likeContainsPattern(query))})
    ) matched
    WHERE matched."trainingCount" > 0
    ORDER BY matched."starts" DESC, matched."order" ASC, matched."title" ASC
    LIMIT ${PUBLIC_SEARCH_LIMITS.categories}
  `;
  return rows.map((row) => ({ slug: row.slug, title: row.title, meta: null, trainingCount: row.trainingCount }));
}

async function searchServices(query: string): Promise<PublicSearchItem[]> {
  return getDb().$queryRaw<PublicSearchItem[]>`
    SELECT s."slug", s."title", s."summary" AS "meta"
    FROM "Service" s
    WHERE s."deletedAt" IS NULL AND s."status" = 'PUBLISHED'
      AND (${anyColumnLike(['s."title"', 's."slug"', 's."summary"'], likeContainsPattern(query))})
    ORDER BY ${startsFirst('s."title"', query)}, s."order" ASC, s."title" ASC
    LIMIT ${PUBLIC_SEARCH_LIMITS.services}
  `;
}

function tooManySearches(retryAfterMs: number): HttpError {
  const seconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
  return new HttpError(429, "TOO_MANY_REQUESTS", "Terlalu banyak pencarian. Coba lagi sebentar.", undefined, undefined, {
    "Retry-After": String(seconds),
    "Cache-Control": "no-store",
  });
}

// Rate limit per IP (setiap permintaan dihitung); IP tak terbaca mengikuti RATE_LIMIT_UNKNOWN_IP.
export async function publicSearch(
  rawQuery: string,
  meta: PublicSearchMeta,
  now = new Date(),
  limiter: RateLimiter = getPublicSearchRateLimiter(),
): Promise<PublicSearchResult> {
  const ipKey = ipRateLimitKey(meta.ip, meta.unknownIpMode ?? "shared");
  if (ipKey !== null) {
    const status = limiter.status(ipKey, now.getTime());
    if (status.blocked) throw tooManySearches(status.retryAfterMs);
    limiter.recordFailure(ipKey, now.getTime());
  }

  const q = rawQuery.trim();
  const [trainings, categories, services] = await Promise.all([
    searchTrainings(q, now),
    searchCategories(q, now),
    searchServices(q),
  ]);
  const groups = [
    { group: "trainings" as const, items: trainings },
    { group: "categories" as const, items: categories },
    { group: "services" as const, items: services },
  ];
  return { q, groups: groups.filter((group) => group.items.length > 0) };
}
