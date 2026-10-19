import { describe, expect, it } from "vitest";
import { slugSchema } from "../../src/lib/slug";
import {
  POSTS_PER_CATEGORY,
  POSTS_PER_CATEGORY_OVERRIDE,
  referenceCategories,
  referenceMenuCategories,
  referencePosts,
  referenceSnapshotSlugs,
  referenceTraining,
} from "./reference-training";

describe("snapshot katalog referensi", () => {
  it("memilih paling banyak 10 pelatihan per kategori tanpa menghilangkan kategori", () => {
    expect(referenceSnapshotSlugs).toHaveLength(5831);
    const perCategory = new Map<string, number>();
    for (const post of referencePosts) {
      for (const slug of referenceTraining(post).categorySlugs) perCategory.set(slug, (perCategory.get(slug) ?? 0) + 1);
    }
    expect(perCategory.size).toBe(referenceCategories.length);
    expect(Math.max(...perCategory.values())).toBe(POSTS_PER_CATEGORY);
    for (const [slug, cap] of Object.entries(POSTS_PER_CATEGORY_OVERRIDE)) {
      expect(perCategory.get(slug), slug).toBe(cap);
    }
    expect(referencePosts.length).toBeLessThan(1000);
    for (const category of referenceCategories) {
      expect(perCategory.get(category.slug) ?? 0, category.slug).toBeGreaterThan(0);
    }
  });

  it("memuat judul terpilih dengan slug unik dan kategori yang dapat dibuka", () => {
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
