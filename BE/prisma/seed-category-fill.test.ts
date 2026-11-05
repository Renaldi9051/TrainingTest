import { describe, expect, it } from "vitest";
import {
  CATEGORY_FILL_SKIP,
  CATEGORY_FILL_SLUGS,
  CATEGORY_FILL_TOPIC_PICKS,
  CATEGORY_FILL_TRASH_PICKS,
  normalizeTitle,
} from "./seed-category-fill";
import { referenceCategories, referenceSnapshotSlugs } from "./seed-data/reference-training";

describe("isi kategori sampai 10", () => {
  it("semua slug target ada di katalog referensi, tanpa dobel", () => {
    const slugs = new Set(referenceCategories.map((category) => category.slug));
    expect(CATEGORY_FILL_SLUGS.filter((slug) => !slugs.has(slug))).toEqual([]);
    expect(new Set(CATEGORY_FILL_SLUGS).size).toBe(CATEGORY_FILL_SLUGS.length);
  });

  it("kategori yang dilewati (uji/typo/duplikat/umum) tidak ikut diisi", () => {
    const skipped: string[] = Object.values(CATEGORY_FILL_SKIP).flat();
    expect(skipped.filter((slug) => CATEGORY_FILL_SLUGS.includes(slug))).toEqual([]);
    expect(new Set(skipped).size).toBe(skipped.length);
  });

  it("pilihan topik: kategori target, slug snapshot, tidak dipakai dua kategori", () => {
    expect(Object.keys(CATEGORY_FILL_TOPIC_PICKS).filter((slug) => !CATEGORY_FILL_SLUGS.includes(slug))).toEqual([]);
    const picks = Object.values(CATEGORY_FILL_TOPIC_PICKS).flat();
    const snapshotSlugs = new Set(referenceSnapshotSlugs);
    expect(picks.filter((slug) => !snapshotSlugs.has(slug))).toEqual([]);
    expect(new Set(picks).size).toBe(picks.length);
  });

  it("pilihan Sampah seed sendiri: kategori target, bukan slug snapshot, tidak bentrok dengan pilihan topik", () => {
    expect(Object.keys(CATEGORY_FILL_TRASH_PICKS).filter((slug) => !CATEGORY_FILL_SLUGS.includes(slug))).toEqual([]);
    const picks = Object.values(CATEGORY_FILL_TRASH_PICKS).flat();
    const snapshotSlugs = new Set(referenceSnapshotSlugs);
    expect(picks.filter((slug) => snapshotSlugs.has(slug))).toEqual([]);
    const all = [...picks, ...Object.values(CATEGORY_FILL_TOPIC_PICKS).flat()];
    expect(new Set(all).size).toBe(all.length);
  });

  it("judul kembar: awalan Training/Pelatihan, huruf besar, dan tanda baca diabaikan", () => {
    expect(normalizeTitle("PELATIHAN QA & QC PEMELIHARAAN BANGUNAN GEDUNG")).toBe(
      normalizeTitle("TRAINING QA &amp; QC Pemeliharaan Bangunan Gedung"),
    );
    expect(normalizeTitle("Training Building Management")).not.toBe(normalizeTitle("Training Building Maintenance"));
  });
});
