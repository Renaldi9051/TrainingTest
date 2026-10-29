import { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import { collectTextValues, foldText, likeContainsPattern, matchSnippet, TYPO_SIMILARITY_THRESHOLD } from "@/lib/search";
import { anyColumnLike, startsFirst, trainingTextSearch } from "@/lib/search-sql";

// Search global admin (Ctrl/Cmd+K, PRD 6.1): semua konten termasuk draf, media, dan nilai pengaturan.
// Item di Sampah (deletedAt) tidak ikut. Maks PER_GROUP hasil per grup; grup kosong tidak dikirim.
// URL tujuan dibentuk FE dari grup + id (FE yang tahu route admin).

export const PER_GROUP = 5;

export const ADMIN_SEARCH_GROUPS = [
  "trainings",
  "categories",
  "services",
  "pages",
  "home",
  "portfolio",
  "clients",
  "testimonials",
  "marketing",
  "media",
  "navigation",
  "settings",
] as const;

export type AdminSearchGroup = (typeof ADMIN_SEARCH_GROUPS)[number];

export type AdminSearchItem = {
  id: string;
  title: string;
  // Baris kedua: potongan teks yang cocok, slug, atau keterangan singkat.
  meta: string | null;
  status: "DRAFT" | "PUBLISHED" | null;
  // Khusus pengaturan: properti di dalam key (mis. key "site.contact", field "whatsapp").
  field?: string;
};

export type AdminSearchResult = {
  q: string;
  groups: { group: AdminSearchGroup; items: AdminSearchItem[] }[];
};

type Row = { id: string; title: string; meta: string | null; status?: "DRAFT" | "PUBLISHED" | null };

const toItem = (row: Row): AdminSearchItem => ({
  id: row.id,
  title: row.title,
  meta: row.meta ?? null,
  status: row.status ?? null,
});

async function searchTrainings(query: string): Promise<AdminSearchItem[]> {
  const { match, rank } = trainingTextSearch(query);
  const rows = await getDb().$transaction(async (tx) => {
    // Ambang typo hanya untuk transaksi ini (SET LOCAL), sama dengan katalog publik.
    await tx.$executeRaw`SELECT set_config('pg_trgm.word_similarity_threshold', ${String(TYPO_SIMILARITY_THRESHOLD)}, true)`;
    return tx.$queryRaw<Row[]>`
      SELECT t."id", t."title", t."slug" AS "meta", t."status"::text AS "status"
      FROM "Training" t
      WHERE t."deletedAt" IS NULL AND ${match}
      ORDER BY (${rank}) DESC, t."updatedAt" DESC, t."id" ASC
      LIMIT ${PER_GROUP}
    `;
  });
  return rows.map(toItem);
}

// Entitas dengan teks pendek: satu query LIKE berparameter per tabel.
type TextSpec = {
  table: string;
  title: string;
  meta: string;
  status?: string;
  columns: string[];
};

const TEXT_SPECS = {
  categories: { table: "Category", title: '"name"', meta: '"slug"', columns: ['"name"', '"slug"', '"description"'] },
  services: {
    table: "Service",
    title: '"title"',
    meta: '"slug"',
    status: '"status"::text',
    columns: ['"title"', '"slug"', '"summary"'],
  },
  portfolio: {
    table: "PortfolioItem",
    title: '"title"',
    meta: '"client"',
    columns: ['"title"', '"client"', '"description"'],
  },
  clients: { table: "Client", title: '"name"', meta: '"url"', columns: ['"name"', '"url"'] },
  testimonials: {
    table: "Testimonial",
    title: '"name"',
    meta: `concat_ws(' · ', "role", "company")`,
    columns: ['"name"', '"role"', '"company"', '"quote"'],
  },
  marketing: { table: "MarketingContact", title: '"name"', meta: '"phone"', columns: ['"name"', '"phone"', '"defaultMessage"'] },
  media: {
    table: "Media",
    title: `coalesce(nullif("originalName", ''), "path")`,
    meta: '"alt"',
    columns: ['"originalName"', '"path"', '"alt"'],
  },
} satisfies Record<string, TextSpec>;

async function searchText(spec: TextSpec, query: string): Promise<AdminSearchItem[]> {
  const pattern = likeContainsPattern(query);
  const status = spec.status ? Prisma.raw(spec.status) : Prisma.sql`NULL`;
  const rows = await getDb().$queryRaw<Row[]>`
    SELECT "id", ${Prisma.raw(spec.title)} AS "title", ${Prisma.raw(spec.meta)} AS "meta", ${status} AS "status"
    FROM ${Prisma.raw(`"${spec.table}"`)}
    WHERE "deletedAt" IS NULL AND (${anyColumnLike(spec.columns, pattern)})
    ORDER BY ${startsFirst(spec.title, query)}, "updatedAt" DESC, "id" ASC
    LIMIT ${PER_GROUP}
  `;
  return rows.map(toItem);
}

// Tabel kecil berisi JSON (blok halaman, section beranda): dicocokkan di aplikasi, hanya nilai string
// konten (lihat collectTextValues), supaya nama node rich text/enum tidak ikut tercari.
function firstSnippet(texts: string[], query: string): string | null {
  for (const text of texts) {
    const snippet = matchSnippet(text, query);
    if (snippet) return snippet;
  }
  return null;
}

function rankAndLimit<T extends { title: string; updatedAt: Date }>(rows: T[], query: string): T[] {
  const needle = foldText(query);
  return rows
    .map((row) => ({ row, starts: foldText(row.title).startsWith(needle) }))
    .sort((a, b) => Number(b.starts) - Number(a.starts) || b.row.updatedAt.getTime() - a.row.updatedAt.getTime())
    .slice(0, PER_GROUP)
    .map(({ row }) => row);
}

async function searchPages(query: string): Promise<AdminSearchItem[]> {
  const pages = await getDb().page.findMany({
    where: { deletedAt: null },
    select: { id: true, title: true, slug: true, status: true, blocks: true, updatedAt: true },
  });
  const hits = pages.flatMap((page) => {
    // Judul/slug cocok: baris kedua slug; kalau tidak, potongan isi blok yang cocok.
    const meta =
      matchSnippet(page.title, query) || matchSnippet(page.slug, query)
        ? page.slug
        : firstSnippet(collectTextValues(page.blocks), query);
    return meta ? [{ ...page, meta }] : [];
  });
  return rankAndLimit(hits, query).map((page) => toItem({ id: page.id, title: page.title, meta: page.meta, status: page.status }));
}

async function searchHomeSections(query: string): Promise<AdminSearchItem[]> {
  const sections = await getDb().homeSection.findMany({
    where: { deletedAt: null },
    select: { id: true, type: true, title: true, content: true, updatedAt: true },
  });
  const hits = sections.flatMap((section) => {
    const title = section.title || section.type;
    // Judul cocok: baris kedua jenis section; kalau tidak, potongan isi yang cocok.
    const meta = matchSnippet(title, query) ? section.type : firstSnippet(collectTextValues(section.content), query);
    return meta ? [{ ...section, title, meta }] : [];
  });
  return rankAndLimit(hits, query).map((section) => toItem({ id: section.id, title: section.title, meta: section.meta }));
}

async function searchNavigation(query: string): Promise<AdminSearchItem[]> {
  const items = await getDb().navItem.findMany({
    where: { deletedAt: null },
    select: { id: true, label: true, href: true, location: true, updatedAt: true },
  });
  const hits = items
    .filter((item) => matchSnippet(item.label, query) || matchSnippet(item.href, query))
    .map((item) => ({ ...item, title: item.label }));
  return rankAndLimit(hits, query).map((item) => toItem({ id: item.id, title: item.label, meta: `${item.location} · ${item.href}` }));
}

// Nilai pengaturan: satu hasil per properti tingkat atas yang cocok (mis. site.contact → whatsapp).
async function searchSettings(query: string): Promise<AdminSearchItem[]> {
  const settings = await getDb().siteSetting.findMany({ select: { key: true, value: true } });
  const items: AdminSearchItem[] = [];
  for (const setting of settings) {
    if (!setting.value || typeof setting.value !== "object" || Array.isArray(setting.value)) continue;
    for (const [field, value] of Object.entries(setting.value)) {
      if (/Ids?$/.test(field)) continue;
      const snippet = firstSnippet(collectTextValues(value), query);
      if (snippet) items.push({ id: setting.key, field, title: snippet, meta: null, status: null });
    }
  }
  return items.slice(0, PER_GROUP);
}

export async function adminSearch(rawQuery: string): Promise<AdminSearchResult> {
  const q = rawQuery.trim();
  const searches: Record<AdminSearchGroup, () => Promise<AdminSearchItem[]>> = {
    trainings: () => searchTrainings(q),
    categories: () => searchText(TEXT_SPECS.categories, q),
    services: () => searchText(TEXT_SPECS.services, q),
    pages: () => searchPages(q),
    home: () => searchHomeSections(q),
    portfolio: () => searchText(TEXT_SPECS.portfolio, q),
    clients: () => searchText(TEXT_SPECS.clients, q),
    testimonials: () => searchText(TEXT_SPECS.testimonials, q),
    marketing: () => searchText(TEXT_SPECS.marketing, q),
    media: () => searchText(TEXT_SPECS.media, q),
    navigation: () => searchNavigation(q),
    settings: () => searchSettings(q),
  };
  const results = await Promise.all(ADMIN_SEARCH_GROUPS.map((group) => searches[group]()));
  return {
    q,
    groups: ADMIN_SEARCH_GROUPS.flatMap((group, index) => (results[index].length > 0 ? [{ group, items: results[index] }] : [])),
  };
}
