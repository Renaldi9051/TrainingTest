import type { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import { listMeta, pagination, type ListMeta } from "@/lib/list-query";
import { renderRichText } from "@/lib/rich-text";
import type { PublicArticleQuery } from "@/lib/validators/article";
import { activeMediaDto, getMediaMap, toPublicImage, type PublicImage } from "@/services/media";
import { parseSeo } from "@/services/training";

// Aturan tampil publik, dipakai SEMUA query publik artikel: belum dihapus, PUBLISHED, dan waktu
// publish sudah lewat (artikel terjadwal belum tampil).
export function publicArticleWhere(now: Date): Prisma.ArticleWhereInput {
  return { deletedAt: null, status: "PUBLISHED", publishedAt: { lte: now } };
}

export type PublicArticleCategory = { slug: string; name: string };

export type PublicArticleCard = {
  slug: string;
  title: string;
  excerpt: string | null;
  authorName: string;
  cover: PublicImage | null;
  category: PublicArticleCategory | null;
  publishedAt: Date;
};

export type PublicArticleDetail = PublicArticleCard & {
  bodyHtml: string | null;
  sourceName: string | null;
  sourceUrl: string | null;
  seo: { title: string; description: string; ogImage: PublicImage | null };
  related: PublicArticleCard[];
  updatedAt: Date;
};

export type PublicArticleCategoryCount = PublicArticleCategory & { count: number };

const cardInclude = {
  cover: true,
  category: { select: { slug: true, name: true, deletedAt: true } },
} satisfies Prisma.ArticleInclude;

type CardRow = Prisma.ArticleGetPayload<{ include: typeof cardInclude }>;

function toCard(row: CardRow): PublicArticleCard {
  const category = row.category && row.category.deletedAt === null ? row.category : null;
  return {
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    authorName: row.authorName,
    cover: toPublicImage(activeMediaDto(row.cover)),
    category: category ? { slug: category.slug, name: category.name } : null,
    // publicArticleWhere menjamin publishedAt terisi; preview draf memakai createdAt.
    publishedAt: row.publishedAt ?? row.createdAt,
  };
}

const newestFirst: Prisma.ArticleOrderByWithRelationInput[] = [{ publishedAt: "desc" }, { id: "desc" }];

// ===== Daftar =====

export async function listPublicArticles(
  query: PublicArticleQuery,
  now = new Date(),
): Promise<{ items: PublicArticleCard[]; meta: ListMeta & { kategori: string | null } }> {
  const where: Prisma.ArticleWhereInput = {
    ...publicArticleWhere(now),
    ...(query.kategori ? { category: { slug: query.kategori, deletedAt: null } } : {}),
  };
  const db = getDb();
  const [rows, total] = await Promise.all([
    db.article.findMany({ where, include: cardInclude, orderBy: newestFirst, ...pagination(query.hal, query.per) }),
    db.article.count({ where }),
  ]);
  return {
    items: rows.map(toCard),
    meta: { ...listMeta(query.hal, query.per, total), kategori: query.kategori ?? null },
  };
}

// Kategori yang punya minimal satu artikel tayang, urut sesuai urutan admin (chip filter).
export async function listPublicArticleCategories(now = new Date()): Promise<PublicArticleCategoryCount[]> {
  const rows = await getDb().articleCategory.findMany({
    where: { deletedAt: null },
    select: { slug: true, name: true, _count: { select: { articles: { where: publicArticleWhere(now) } } } },
    orderBy: [{ order: "asc" }, { name: "asc" }],
  });
  return rows
    .filter((row) => row._count.articles > 0)
    .map((row) => ({ slug: row.slug, name: row.name, count: row._count.articles }));
}

// Slug artikel tayang terbaru, untuk generateStaticParams di FE.
export async function listPublicArticleSlugs(limit: number, now = new Date()): Promise<string[]> {
  const rows = await getDb().article.findMany({
    where: publicArticleWhere(now),
    select: { slug: true },
    orderBy: newestFirst,
    take: limit,
  });
  return rows.map((row) => row.slug);
}

// ===== Detail =====

const RELATED_LIMIT = 3;

// Artikel terkait: kategori sama dulu, lalu artikel terbaru lain sebagai pelengkap.
async function relatedArticles(row: CardRow & { id: string; categoryId: string | null }, now: Date) {
  const db = getDb();
  const base = { ...publicArticleWhere(now), id: { not: row.id } };
  const sameCategory = row.categoryId
    ? await db.article.findMany({
        where: { ...base, categoryId: row.categoryId },
        include: cardInclude,
        orderBy: newestFirst,
        take: RELATED_LIMIT,
      })
    : [];
  const missing = RELATED_LIMIT - sameCategory.length;
  const others =
    missing > 0
      ? await db.article.findMany({
          where: { ...base, id: { notIn: [row.id, ...sameCategory.map((item) => item.id)] } },
          include: cardInclude,
          orderBy: newestFirst,
          take: missing,
        })
      : [];
  return [...sameCategory, ...others].map(toCard);
}

async function toDetail(
  row: Prisma.ArticleGetPayload<{ include: typeof cardInclude }>,
  now: Date,
): Promise<PublicArticleDetail> {
  const seo = parseSeo(row.seo);
  const media = await getMediaMap([seo.ogImageId]);
  return {
    ...toCard(row),
    bodyHtml: renderRichText(row.body),
    sourceName: row.sourceName,
    sourceUrl: row.sourceUrl,
    seo: {
      title: seo.title,
      description: seo.description,
      ogImage: toPublicImage(seo.ogImageId ? media.get(seo.ogImageId) : null),
    },
    related: await relatedArticles(row, now),
    updatedAt: row.updatedAt,
  };
}

export async function getPublicArticle(slug: string, now = new Date()): Promise<PublicArticleDetail | null> {
  const row = await getDb().article.findFirst({ where: { ...publicArticleWhere(now), slug }, include: cardInclude });
  return row ? toDetail(row, now) : null;
}

// Pratinjau admin (draft mode): draf & terjadwal ikut, yang di Sampah tidak.
export async function getArticlePreview(slug: string, now = new Date()): Promise<PublicArticleDetail | null> {
  const row = await getDb().article.findFirst({ where: { slug, deletedAt: null }, include: cardInclude });
  return row ? toDetail(row, now) : null;
}
