import { describe, expect, it } from "vitest";
import { articleListHref, parseArticleListState } from "@/lib/article-url";

describe("URL daftar artikel", () => {
  it("membaca kategori & halaman; nilai aneh diabaikan", () => {
    expect(parseArticleListState({ kategori: "teknologi", hal: "2" })).toEqual({ kategori: "teknologi", hal: 2 });
    expect(parseArticleListState({ kategori: "<script>", hal: "-1" })).toEqual({ kategori: null, hal: 1 });
    expect(parseArticleListState({ kategori: ["berita", "x"], hal: "abc" })).toEqual({ kategori: "berita", hal: 1 });
  });

  it("ganti kategori kembali ke halaman 1; halaman 1 tidak ditulis di URL", () => {
    const state = { kategori: "teknologi", hal: 3 };
    expect(articleListHref(state, { kategori: "berita" })).toBe("/artikel?kategori=berita");
    expect(articleListHref(state, { kategori: null })).toBe("/artikel");
    expect(articleListHref(state, { hal: 4 })).toBe("/artikel?kategori=teknologi&hal=4");
    expect(articleListHref({ kategori: null, hal: 2 }, { hal: 1 })).toBe("/artikel");
  });
});
