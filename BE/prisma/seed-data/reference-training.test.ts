import { describe, expect, it } from "vitest";
import { slugSchema } from "../../src/lib/slug";
import { trainingCreateSchema } from "../../src/lib/validators/training";
import {
  hasReferenceTitle,
  referenceCategories,
  referenceMenuCategories,
  referencePosts,
  referenceTraining,
} from "./reference-training";

describe("snapshot katalog referensi", () => {
  it("memuat seluruh judul publik dengan slug unik dan kategori yang dapat dibuka", () => {
    expect(referencePosts).toHaveLength(5831);
    expect(referenceCategories.length).toBeGreaterThan(300);
    expect(new Set(referencePosts.map((post) => post.slug)).size).toBe(referencePosts.length);
    const categories = new Set(referenceCategories.map((item) => item.slug));
    expect(categories.has("evaluasi")).toBe(false);
    const ethicsTraining = referencePosts.find((item) => item.slug === "training-evaluasi-etika-dan-kepatuhan");
    expect(ethicsTraining).toBeDefined();
    expect(referenceTraining(ethicsTraining!).categorySlugs).not.toContain("evaluasi");
    expect(referenceTraining(ethicsTraining!).categorySlugs).toContain("etika");
    for (const post of referencePosts) {
      expect(slugSchema.safeParse(post.slug).success, post.slug).toBe(true);
      expect(referenceTraining(post).categorySlugs.every((slug) => categories.has(slug)), post.slug).toBe(true);
    }
  });

  it("post tanpa judul tidak diimpor; yang lain lolos aturan judul admin", () => {
    const skipped = referencePosts.filter((post) => !hasReferenceTitle(post)).map((post) => post.slug);
    expect(skipped).toHaveLength(10);
    expect(skipped).toContain("51634-2");
    expect(hasReferenceTitle({ title: "  <b> </b> " })).toBe(false);
    expect(hasReferenceTitle({ title: "Training KPI" })).toBe(true);
    // Validator admin menolak judul kosong / spasi saja.
    const CATEGORY = "0199b4d0-0000-7000-8000-000000000001";
    expect(trainingCreateSchema.safeParse({ title: "", categoryIds: [CATEGORY] }).success).toBe(false);
    expect(trainingCreateSchema.safeParse({ title: "   ", categoryIds: [CATEGORY] }).success).toBe(false);
  });

  it("menu Accounting menuju kategori yang ada dan artikel Finance & Treasury memiliki isi khusus", () => {
    expect(referenceMenuCategories).toHaveLength(77);
    const categories = new Set(referenceCategories.map((item) => item.slug));
    expect(referenceMenuCategories.every((item) => categories.has(item.slug))).toBe(true);
    expect(referenceMenuCategories[0]).toEqual({ name: "accounting", slug: "accounting" });
    const post = referencePosts.find((item) => item.slug === "training-finance-treasury-management");
    expect(post).toBeDefined();
    const training = referenceTraining(post!);
    expect(training.categorySlugs).toContain("accounting");
    expect(training.modules.map((module) => module.title)).toContain("Perencanaan arus kas");
    expect(training.outcomes.length).toBeGreaterThanOrEqual(4);
    expect(JSON.stringify(training.description)).not.toContain("Diorama Training");
  });
});
