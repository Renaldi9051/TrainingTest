import { describe, expect, it } from "vitest";
import { byPrimaryThenOrder, categoryLinks, orderedCategories } from "./training-categories";

const link = (slug: string, order: number, isPrimary = false, deletedAt: Date | null = null) => ({
  isPrimary,
  category: { slug, order, deletedAt },
});

describe("kategori pelatihan (utama + tambahan)", () => {
  it("kategori utama dulu, lalu urutan admin; kategori terhapus tidak ikut", () => {
    const result = orderedCategories([
      link("management", 0),
      link("customer", 9, true),
      link("accounting", 2),
      link("lama", 1, false, new Date()),
    ]);
    expect(result.map((item) => item.slug)).toEqual(["customer", "management", "accounting"]);
    expect(result[0].isPrimary).toBe(true);
  });

  it("tanpa penanda utama (data lama): urutan admin", () => {
    expect([{ order: 4 }, { order: 1 }].sort(byPrimaryThenOrder)).toEqual([{ order: 1 }, { order: 4 }]);
  });

  it("categoryIds: elemen pertama = kategori utama", () => {
    expect(categoryLinks(["a", "b"])).toEqual([
      { categoryId: "a", isPrimary: true },
      { categoryId: "b", isPrimary: false },
    ]);
  });
});
