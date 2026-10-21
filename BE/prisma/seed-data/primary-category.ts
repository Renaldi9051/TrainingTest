// Memilih SATU kategori per pelatihan (keputusan pemilik, 21 Okt 2026: satu pelatihan satu kategori).
// Dipakai seed perapian satu kategori dan seed katalog referensi. Kandidat: kategori pelatihan sekarang
// ditambah kategori aktif lain yang nama/kata kuncinya ada di judul (tag sumber sering tidak tepat).
// Urutan aturan (deterministik):
// 1. kategori bertopik, lalu tag luas (education, company, ...), terakhir tag generik (training, ...);
// 2. kata kunci kategori ada di judul;
// 3. prioritas khusus untuk kategori yang sering tumpang tindih (drone > pemetaan > survey > mapping);
// 4. kategori menu header yang sudah dimiliki pelatihan (topik utama yang dijelajahi pengunjung;
//    pemilik memilih "menu utama dulu", 21 Okt 2026);
// 5. nama kategori ada di judul, nama terpanjang (paling spesifik) lebih dulu;
// 6. kategori yang sudah dimiliki pelatihan; 7. kategori di menu header; 8. urutan kategori, lalu slug.
import { containsWholeWord } from "../../src/lib/search";

export type CategoryCandidate = {
  id: string;
  slug: string;
  name: string;
  keywords: readonly string[];
  order: number;
  inMenu: boolean;
};

// Kategori yang bukan topik pelatihan (tag WordPress sumber). Hanya dipilih kalau tidak ada pilihan lain.
export const GENERIC_CATEGORY_SLUGS = new Set([
  "training",
  "pelatihan",
  "slider",
  "uncategorized",
  "skill",
  "softskill",
  "aplikasi",
  "data",
  "report",
  "system",
]);

// Tag luas: boleh dipilih, tapi kalah dari kategori bertopik.
export const BROAD_CATEGORY_SLUGS = new Set([
  "education",
  "company",
  "employee",
  "industri",
  "industrial",
  "technology",
  "service",
  "social",
  "economy",
  "personal-development",
  "personality",
  "motivasional",
  "organization",
]);

export const PRIORITY_CATEGORY_SLUGS = ["drone", "pemetaan", "survey", "mapping"];

function tier(category: CategoryCandidate): number {
  if (GENERIC_CATEGORY_SLUGS.has(category.slug)) return 2;
  return BROAD_CATEGORY_SLUGS.has(category.slug) ? 1 : 0;
}

const keywordMatch = (title: string, category: CategoryCandidate) =>
  category.keywords.some((keyword) => containsWholeWord(title, keyword));

function rank(title: string, category: CategoryCandidate, current: ReadonlySet<string>): (number | string)[] {
  const priority = PRIORITY_CATEGORY_SLUGS.indexOf(category.slug);
  const nameMatch = containsWholeWord(title, category.name);
  return [
    tier(category),
    keywordMatch(title, category) ? 0 : 1,
    priority === -1 ? PRIORITY_CATEGORY_SLUGS.length : priority,
    category.inMenu && current.has(category.id) ? 0 : 1,
    nameMatch ? 0 : 1,
    nameMatch ? -category.name.length : 0,
    current.has(category.id) ? 0 : 1,
    category.inMenu ? 0 : 1,
    category.order,
    category.slug,
  ];
}

function compare(a: (number | string)[], b: (number | string)[]): number {
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] === b[index]) continue;
    return a[index] < b[index] ? -1 : 1;
  }
  return 0;
}

// current: kategori aktif pelatihan sekarang. all: semua kategori aktif (kandidat dari judul).
export function pickPrimaryCategory<T extends CategoryCandidate>(
  title: string,
  current: readonly T[],
  all: readonly T[] = [],
): T | null {
  const currentIds = new Set(current.map((category) => category.id));
  const fromTitle = all.filter(
    (category) =>
      !currentIds.has(category.id) &&
      !GENERIC_CATEGORY_SLUGS.has(category.slug) &&
      (containsWholeWord(title, category.name) || keywordMatch(title, category)),
  );
  let winner: { category: T; key: (number | string)[] } | null = null;
  for (const category of [...current, ...fromTitle]) {
    const key = rank(title, category, currentIds);
    if (!winner || compare(key, winner.key) < 0) winner = { category, key };
  }
  return winner?.category ?? null;
}
