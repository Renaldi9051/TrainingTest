// Memilih SATU kategori per pelatihan (keputusan pemilik, 21 Okt 2026: satu pelatihan satu kategori).
// Dipakai seed perapian satu kategori dan seed katalog referensi. Deterministik: urutan aturan
// 1. kategori bertopik (bukan generik) lebih dulu;
// 2. kata kunci kategori ada di judul;
// 3. prioritas khusus untuk kategori yang sering tumpang tindih (drone > pemetaan > survey > mapping);
// 4. nama kategori ada di judul;
// 5. kategori di menu header; 6. urutan kategori, lalu slug.
// Kalau semua kategorinya generik, cari kategori bertopik lain yang nama/kata kuncinya ada di judul.
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

export const PRIORITY_CATEGORY_SLUGS = ["drone", "pemetaan", "survey", "mapping"];

const isGeneric = (category: CategoryCandidate) => GENERIC_CATEGORY_SLUGS.has(category.slug);

function rank(title: string, category: CategoryCandidate): (number | string)[] {
  const priority = PRIORITY_CATEGORY_SLUGS.indexOf(category.slug);
  return [
    isGeneric(category) ? 1 : 0,
    category.keywords.some((keyword) => containsWholeWord(title, keyword)) ? 0 : 1,
    priority === -1 ? PRIORITY_CATEGORY_SLUGS.length : priority,
    containsWholeWord(title, category.name) ? 0 : 1,
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

function best<T extends CategoryCandidate>(title: string, candidates: readonly T[]): T | null {
  let winner: { category: T; key: (number | string)[] } | null = null;
  for (const category of candidates) {
    const key = rank(title, category);
    if (!winner || compare(key, winner.key) < 0) winner = { category, key };
  }
  return winner?.category ?? null;
}

// current: kategori aktif pelatihan sekarang. all: semua kategori aktif (untuk fallback generik).
export function pickPrimaryCategory<T extends CategoryCandidate>(
  title: string,
  current: readonly T[],
  all: readonly T[] = [],
): T | null {
  if (current.length > 0 && current.some((category) => !isGeneric(category))) return best(title, current);
  const topical = all.filter(
    (category) =>
      !isGeneric(category) &&
      (containsWholeWord(title, category.name) || category.keywords.some((keyword) => containsWholeWord(title, keyword))),
  );
  return best(title, topical) ?? best(title, current);
}
