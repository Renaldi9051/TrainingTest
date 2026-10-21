import { describe, expect, it } from "vitest";
import { CATEGORY_FILL_SLUGS, normalizeTitle } from "./seed-category-fill";
import { referenceCategories } from "./seed-data/reference-training";

describe("isi kategori sampai 10", () => {
  it("semua slug target ada di katalog referensi", () => {
    const slugs = new Set(referenceCategories.map((category) => category.slug));
    expect(CATEGORY_FILL_SLUGS.filter((slug) => !slugs.has(slug))).toEqual([]);
  });

  it("judul kembar: awalan Training/Pelatihan, huruf besar, dan tanda baca diabaikan", () => {
    expect(normalizeTitle("PELATIHAN QA & QC PEMELIHARAAN BANGUNAN GEDUNG")).toBe(
      normalizeTitle("TRAINING QA &amp; QC Pemeliharaan Bangunan Gedung"),
    );
    expect(normalizeTitle("Training Building Management")).not.toBe(normalizeTitle("Training Building Maintenance"));
  });
});
