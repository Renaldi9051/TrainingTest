import { describe, expect, it } from "vitest";
import { keywordsSchema } from "../src/lib/validators/category";
import { CLEANUP_GENERIC, CLEANUP_KEYWORDS, CLEANUP_MERGES } from "./seed-category-cleanup";
import { BROAD_CATEGORY_SLUGS, GENERIC_CATEGORY_SLUGS, PRIORITY_CATEGORY_SLUGS } from "./seed-data/primary-category";
import { referenceCategories } from "./seed-data/reference-training";

const referenceSlugs = new Set(referenceCategories.map((category) => category.slug));

describe("perapian kategori referensi", () => {
  it("semua slug ada di katalog referensi (salah ketik tidak boleh diam-diam dilewati)", () => {
    const slugs = [
      ...Object.keys(CLEANUP_KEYWORDS),
      ...CLEANUP_MERGES.flatMap(({ from, to }) => [from, to]),
      ...CLEANUP_GENERIC,
    ];
    expect(slugs.filter((slug) => !referenceSlugs.has(slug))).toEqual([]);
  });

  it("tidak ada kategori yang dihapus/digabung sekaligus jadi tujuan atau diberi kata kunci", () => {
    const removed = new Set([...CLEANUP_MERGES.map(({ from }) => from), ...CLEANUP_GENERIC]);
    const kept = [...CLEANUP_MERGES.map(({ to }) => to), ...Object.keys(CLEANUP_KEYWORDS)];
    expect(kept.filter((slug) => removed.has(slug))).toEqual([]);
    expect(new Set(CLEANUP_MERGES.map(({ from }) => from)).size).toBe(CLEANUP_MERGES.length);
  });

  it("slug tag generik, tag luas, dan prioritas pemilih satu kategori ada di katalog referensi", () => {
    const slugs = [...GENERIC_CATEGORY_SLUGS, ...BROAD_CATEGORY_SLUGS, ...PRIORITY_CATEGORY_SLUGS];
    expect(slugs.filter((slug) => !referenceSlugs.has(slug))).toEqual([]);
  });

  it("kata kunci lolos validator admin tanpa berubah", () => {
    for (const keywords of Object.values(CLEANUP_KEYWORDS)) expect(keywordsSchema.parse(keywords)).toEqual(keywords);
  });
});
