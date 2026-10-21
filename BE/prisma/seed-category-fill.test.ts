import { describe, expect, it } from "vitest";
import { CATEGORY_FILL_SLUGS, CATEGORY_FILL_TOPIC_PICKS, normalizeTitle } from "./seed-category-fill";
import { referenceCategories, referenceSnapshotSlugs } from "./seed-data/reference-training";

describe("isi kategori sampai 10", () => {
  it("semua slug target ada di katalog referensi", () => {
    const slugs = new Set(referenceCategories.map((category) => category.slug));
    expect(CATEGORY_FILL_SLUGS.filter((slug) => !slugs.has(slug))).toEqual([]);
  });

  it("pilihan topik: kategori target, slug snapshot, tidak dipakai dua kategori", () => {
    expect(Object.keys(CATEGORY_FILL_TOPIC_PICKS).filter((slug) => !CATEGORY_FILL_SLUGS.includes(slug))).toEqual([]);
    const picks = Object.values(CATEGORY_FILL_TOPIC_PICKS).flat();
    const snapshotSlugs = new Set(referenceSnapshotSlugs);
    expect(picks.filter((slug) => !snapshotSlugs.has(slug))).toEqual([]);
    expect(new Set(picks).size).toBe(picks.length);
  });

  it("judul kembar: awalan Training/Pelatihan, huruf besar, dan tanda baca diabaikan", () => {
    expect(normalizeTitle("PELATIHAN QA & QC PEMELIHARAAN BANGUNAN GEDUNG")).toBe(
      normalizeTitle("TRAINING QA &amp; QC Pemeliharaan Bangunan Gedung"),
    );
    expect(normalizeTitle("Training Building Management")).not.toBe(normalizeTitle("Training Building Maintenance"));
  });
});
