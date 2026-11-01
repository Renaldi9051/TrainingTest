import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockDb, passThroughTransactions, type MockDb } from "@/test/mock-db";

const db = vi.hoisted(() => ({ current: undefined as unknown }));
vi.mock("@/lib/db", () => ({ getDb: () => db.current }));
const revalidate = vi.hoisted(() => vi.fn<(tags: string[]) => Promise<boolean>>(async () => true));
vi.mock("@/lib/revalidate", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/revalidate")>()),
  revalidateTags: revalidate,
}));

import { getPublicArticle, listPublicArticleCategories, listPublicArticles } from "@/services/article-public";
import { deleteArticleCategory } from "@/services/article-category";

const now = new Date("2026-11-01T05:00:00.000Z");
const CATEGORY = "0199b4d0-0000-7000-8000-0000000000c1";
const doc = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Halo <b>" }] }] };

const card = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  slug: `artikel-${id}`,
  title: `Artikel ${id}`,
  excerpt: null,
  body: doc,
  authorName: "Tim Media",
  sourceName: null,
  sourceUrl: null,
  coverId: null,
  cover: null,
  categoryId: CATEGORY,
  category: { slug: "teknologi", name: "Teknologi", deletedAt: null },
  status: "PUBLISHED",
  publishedAt: now,
  seo: null,
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
  ...extra,
});

let mock: MockDb;

beforeEach(() => {
  mock = createMockDb();
  db.current = mock;
  passThroughTransactions(mock);
  revalidate.mockClear();
  mock.media.findMany.mockResolvedValue([]);
});

describe("artikel publik", () => {
  it("daftar hanya artikel tayang (bukan draf/terjadwal), filter slug kategori", async () => {
    mock.article.findMany.mockResolvedValue([card("a")]);
    mock.article.count.mockResolvedValue(1);
    const { items, meta } = await listPublicArticles({ kategori: "teknologi", hal: 1, per: 12 }, now);
    expect(mock.article.findMany.mock.calls[0][0].where).toEqual({
      deletedAt: null,
      status: "PUBLISHED",
      publishedAt: { lte: now },
      category: { slug: "teknologi", deletedAt: null },
    });
    expect(items[0]).toMatchObject({ slug: "artikel-a", category: { slug: "teknologi", name: "Teknologi" } });
    expect(meta).toMatchObject({ total: 1, kategori: "teknologi" });
  });

  it("detail: isi dirender aman (HTML di-escape), kategori terhapus disembunyikan, terkait dilengkapi", async () => {
    mock.article.findFirst.mockResolvedValue(card("a", { category: { slug: "lama", name: "Lama", deletedAt: now } }));
    mock.article.findMany.mockResolvedValueOnce([card("b")]).mockResolvedValueOnce([card("c"), card("d")]);
    const detail = await getPublicArticle("artikel-a", now);
    expect(detail?.bodyHtml).toBe("<p>Halo &lt;b&gt;</p>");
    expect(detail?.category).toBeNull();
    expect(detail?.related.map((item) => item.slug)).toEqual(["artikel-b", "artikel-c", "artikel-d"]);
  });

  it("chip kategori hanya yang punya artikel tayang", async () => {
    mock.articleCategory.findMany.mockResolvedValue([
      { slug: "teknologi", name: "Teknologi", _count: { articles: 2 } },
      { slug: "berita", name: "Berita", _count: { articles: 0 } },
    ]);
    expect(await listPublicArticleCategories(now)).toEqual([{ slug: "teknologi", name: "Teknologi", count: 2 }]);
  });
});

describe("kategori artikel", () => {
  it("tidak bisa dihapus selama masih dipakai artikel", async () => {
    mock.articleCategory.findFirst.mockResolvedValue({ id: CATEGORY, slug: "teknologi", _count: { articles: 3 } });
    await expect(deleteArticleCategory(CATEGORY, "user")).rejects.toMatchObject({ status: 409, code: "CATEGORY_IN_USE" });
    expect(mock.articleCategory.update).not.toHaveBeenCalled();
  });
});
