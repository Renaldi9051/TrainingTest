import { beforeEach, describe, expect, it, vi } from "vitest";
import { isRichTextEmpty, renderRichText, richTextSchema } from "../src/lib/rich-text";
import { slugSchema } from "../src/lib/slug";
import { articleCreateSchema } from "../src/lib/validators/article";
import { createMockDb, type MockDb } from "../src/test/mock-db";
import { sampleArticles } from "./seed-data/articles";

const db = vi.hoisted(() => ({ current: undefined as unknown }));
vi.mock("../src/lib/db", () => ({ getDb: () => db.current }));
vi.mock("../src/lib/revalidate", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/lib/revalidate")>()),
  revalidateTags: vi.fn(async () => true),
}));

const { seedArticles } = await import("./seed-articles");

let mock: MockDb;
const now = new Date("2026-11-01T10:00:00.000Z");

beforeEach(() => {
  mock = createMockDb();
  db.current = mock;
  mock.article.count.mockResolvedValue(0);
  mock.articleCategory.findFirst.mockResolvedValue(null);
  mock.articleCategory.count.mockResolvedValue(0);
  mock.articleCategory.create.mockImplementation(async ({ data }) => ({ id: `cat-${data.slug}` }));
  mock.category.findFirst.mockResolvedValue(null);
});

describe("data artikel contoh", () => {
  it("lolos validator admin: slug, isi rich text tidak kosong dan bisa dirender", () => {
    for (const article of sampleArticles) {
      expect(slugSchema.safeParse(article.slug).success, article.slug).toBe(true);
      expect(slugSchema.safeParse(article.category.slug).success, article.category.slug).toBe(true);
      const body = richTextSchema.parse(article.body);
      expect(isRichTextEmpty(body)).toBe(false);
      expect(renderRichText(body)).toContain("<h2>");
      const parsed = articleCreateSchema.safeParse({
        title: article.title,
        excerpt: article.excerpt,
        authorName: article.authorName,
        categoryId: "0199b4d0-0000-7000-8000-0000000000c1",
        body: article.body,
        status: "PUBLISHED",
      });
      expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
    }
  });
});

describe("seedArticles", () => {
  it("membuat artikel tayang + kategorinya; sampul dari gambar kategori pelatihan yang punya alt", async () => {
    mock.category.findFirst.mockImplementation(async ({ where }) =>
      where.slug === "accounting" ? { image: { id: "media-acc", alt: "Kalkulator", mime: "image/webp", deletedAt: null } } : null,
    );
    expect(await seedArticles(now)).toEqual({ created: 2, skipped: 0 });
    const [first, second] = mock.article.create.mock.calls.map((call) => call[0].data);
    expect(first).toMatchObject({
      slug: "5-kebiasaan-pencatatan-keuangan-yang-memudahkan-audit",
      status: "PUBLISHED",
      categoryId: "cat-keuangan-dan-akuntansi",
      coverId: "media-acc",
      publishRevalidatedAt: now,
    });
    expect(second).toMatchObject({ categoryId: "cat-pengembangan-sdm", coverId: null });
    // Artikel kedua lebih baru, keduanya sudah lewat waktunya.
    expect(second.publishedAt.getTime()).toBeGreaterThan(first.publishedAt.getTime());
    expect(second.publishedAt.getTime()).toBeLessThan(now.getTime());
  });

  it("slug yang sudah pernah ada (termasuk di Sampah) dilewati", async () => {
    mock.article.count.mockResolvedValue(1);
    expect(await seedArticles(now)).toEqual({ created: 0, skipped: 2 });
    expect(mock.article.create).not.toHaveBeenCalled();
    expect(mock.articleCategory.create).not.toHaveBeenCalled();
  });

  it("kategori yang dihapus admin tidak dibuat ulang; artikel tanpa kategori", async () => {
    mock.articleCategory.count.mockResolvedValue(1);
    await seedArticles(now);
    expect(mock.articleCategory.create).not.toHaveBeenCalled();
    expect(mock.article.create.mock.calls[0][0].data.categoryId).toBeNull();
  });

  it("gambar kategori tanpa alt atau sudah dihapus tidak dipakai", async () => {
    mock.category.findFirst.mockResolvedValue({ image: { id: "m", alt: null, mime: "image/webp", deletedAt: null } });
    await seedArticles(now);
    expect(mock.article.create.mock.calls.every((call) => call[0].data.coverId === null)).toBe(true);
  });
});
