import { describe, expect, it } from "vitest";
import {
  articleBulkSchema,
  articleCalendarQuerySchema,
  articleCreateSchema,
  articleUpdateSchema,
  publicArticleQuerySchema,
} from "@/lib/validators/article";
import { mediaImportUrlSchema } from "@/lib/validators/media";

const CATEGORY = "0199b4d0-0000-7000-8000-0000000000c1";
const doc = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Isi" }] }] };

describe("articleCreateSchema", () => {
  it("default: draf, isi kosong jadi null, SEO kosong", () => {
    const parsed = articleCreateSchema.parse({ title: " Drone ", authorName: "Tim Media", categoryId: CATEGORY });
    expect(parsed).toMatchObject({
      title: "Drone",
      status: "DRAFT",
      body: null,
      excerpt: null,
      coverId: null,
      publishedAt: null,
      seo: { title: "", description: "", ogImageId: null },
    });
  });

  it("judul, penulis, dan kategori wajib", () => {
    const result = articleCreateSchema.safeParse({ title: "", authorName: "" });
    expect(result.success).toBe(false);
    const fields = result.error?.issues.map((issue) => issue.path.join("."));
    expect(fields).toEqual(expect.arrayContaining(["title", "authorName", "categoryId"]));
    expect(result.error?.issues.find((issue) => issue.path[0] === "categoryId")?.message).toBe("Pilih kategori.");
  });

  it("dokumen kosong disimpan null; publishedAt ISO dengan offset jadi Date", () => {
    const parsed = articleCreateSchema.parse({
      title: "A",
      authorName: "B",
      categoryId: CATEGORY,
      body: { type: "doc", content: [{ type: "paragraph" }] },
      publishedAt: "2026-11-03T09:00:00+07:00",
    });
    expect(parsed.body).toBeNull();
    expect(parsed.publishedAt).toEqual(new Date("2026-11-03T02:00:00.000Z"));
  });

  it("URL sumber harus http/https; kosong jadi null", () => {
    expect(articleCreateSchema.safeParse({ title: "A", authorName: "B", categoryId: CATEGORY, sourceUrl: "javascript:alert(1)" }).success).toBe(false);
    expect(articleCreateSchema.parse({ title: "A", authorName: "B", categoryId: CATEGORY, sourceUrl: "" }).sourceUrl).toBeNull();
  });

  it("isi rich text mengikuti allowlist", () => {
    expect(articleCreateSchema.parse({ title: "A", authorName: "B", categoryId: CATEGORY, body: doc }).body).toEqual(doc);
    expect(
      articleCreateSchema.safeParse({
        title: "A",
        authorName: "B",
        categoryId: CATEGORY,
        body: { type: "doc", content: [{ type: "image", attrs: { src: "x" } }] },
      }).success,
    ).toBe(false);
  });
});

describe("articleUpdateSchema", () => {
  it("menolak body kosong", () => {
    expect(articleUpdateSchema.safeParse({}).success).toBe(false);
    expect(articleUpdateSchema.safeParse({ title: "Baru" }).success).toBe(true);
  });
});

describe("query", () => {
  it("kalender hanya menerima YYYY-MM", () => {
    expect(articleCalendarQuerySchema.safeParse({ month: "2026-11" }).success).toBe(true);
    expect(articleCalendarQuerySchema.safeParse({ month: "2026-13" }).success).toBe(false);
    expect(articleCalendarQuerySchema.safeParse({ month: "nov" }).success).toBe(false);
  });

  it("query publik: nilai aneh diabaikan, bukan error", () => {
    expect(publicArticleQuerySchema.parse({ kategori: "Bukan Slug!", hal: "-3" })).toEqual({ kategori: undefined, hal: 1, per: 12 });
    expect(publicArticleQuerySchema.parse({ kategori: "teknologi", hal: "2" })).toMatchObject({ kategori: "teknologi", hal: 2 });
  });

  it("aksi massal dikenal saja", () => {
    expect(articleBulkSchema.safeParse({ action: "publish", ids: [CATEGORY] }).success).toBe(true);
    expect(articleBulkSchema.safeParse({ action: "archive", ids: [CATEGORY] }).success).toBe(false);
  });
});

describe("mediaImportUrlSchema", () => {
  it("URL http/https dan alt wajib", () => {
    expect(mediaImportUrlSchema.parse({ url: "https://images.example.com/a.jpg", alt: "Drone" })).toEqual({
      url: "https://images.example.com/a.jpg",
      alt: "Drone",
      folder: null,
    });
    expect(mediaImportUrlSchema.safeParse({ url: "file:///etc/passwd", alt: "x" }).success).toBe(false);
    expect(mediaImportUrlSchema.safeParse({ url: "https://a.com/a.jpg", alt: " " }).success).toBe(false);
  });
});
