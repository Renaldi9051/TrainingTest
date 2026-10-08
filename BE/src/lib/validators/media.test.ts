import { describe, expect, it } from "vitest";
import { mediaListQuerySchema, mediaUpdateSchema } from "@/lib/validators/media";

describe("mediaListQuerySchema", () => {
  it("memberi default dan mengubah string query jadi angka", () => {
    expect(mediaListQuerySchema.parse({})).toEqual({ page: 1, pageSize: 24, sort: "newest" });
    expect(mediaListQuerySchema.parse({ page: "3", pageSize: "12", q: " logo ", sort: "oldest" })).toEqual({
      page: 3,
      pageSize: 12,
      q: "logo",
      sort: "oldest",
    });
  });

  it("menolak pageSize di atas 100 dan sort tidak dikenal", () => {
    expect(mediaListQuerySchema.safeParse({ pageSize: "500" }).success).toBe(false);
    expect(mediaListQuerySchema.safeParse({ sort: "random" }).success).toBe(false);
  });
});

describe("mediaUpdateSchema", () => {
  it("alt/folder kosong jadi null", () => {
    expect(mediaUpdateSchema.parse({ alt: "  ", folder: "" })).toEqual({ alt: null, folder: null });
  });

  it("menolak body tanpa perubahan", () => {
    expect(mediaUpdateSchema.safeParse({}).success).toBe(false);
  });

  it("menolak nama folder dengan karakter path", () => {
    const result = mediaUpdateSchema.safeParse({ folder: "../rahasia" });
    expect(result.success).toBe(false);
  });

  it("menolak alt text lebih dari 300 karakter", () => {
    expect(mediaUpdateSchema.safeParse({ alt: "a".repeat(301) }).success).toBe(false);
  });
});
