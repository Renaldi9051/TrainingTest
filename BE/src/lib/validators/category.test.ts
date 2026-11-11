import { describe, expect, it } from "vitest";
import { categoryCreateSchema, categoryUpdateSchema, publicCategoryTrainingsQuerySchema } from "@/lib/validators/category";

const base = { name: "Keuangan" };

describe("categoryCreateSchema — field landing kategori v2", () => {
  it("default: summary null, coverAlt null, audience [], audienceSource manual, imageIds []", () => {
    const parsed = categoryCreateSchema.parse(base);
    expect(parsed.summary).toBeNull();
    expect(parsed.coverAlt).toBeNull();
    expect(parsed.audience).toEqual([]);
    expect(parsed.audienceSource).toBe("manual");
    expect(parsed.imageIds).toEqual([]);
  });

  it("summary maksimal 160 karakter", () => {
    expect(categoryCreateSchema.safeParse({ ...base, summary: "a".repeat(160) }).success).toBe(true);
    expect(categoryCreateSchema.safeParse({ ...base, summary: "a".repeat(161) }).success).toBe(false);
  });

  it("audience maksimal 12 item, label wajib dan maksimal 120 karakter", () => {
    const item = { label: "Staf", trainingCount: null };
    expect(categoryCreateSchema.safeParse({ ...base, audience: Array(12).fill(item) }).success).toBe(true);
    expect(categoryCreateSchema.safeParse({ ...base, audience: Array(13).fill(item) }).success).toBe(false);
    expect(categoryCreateSchema.safeParse({ ...base, audience: [{ label: "", trainingCount: null }] }).success).toBe(false);
    expect(
      categoryCreateSchema.safeParse({ ...base, audience: [{ label: "a".repeat(121), trainingCount: null }] }).success,
    ).toBe(false);
  });

  it("trainingCount: integer >= 0 atau null", () => {
    expect(categoryCreateSchema.safeParse({ ...base, audience: [{ label: "Staf", trainingCount: 0 }] }).success).toBe(true);
    expect(categoryCreateSchema.safeParse({ ...base, audience: [{ label: "Staf", trainingCount: -1 }] }).success).toBe(false);
    expect(categoryCreateSchema.safeParse({ ...base, audience: [{ label: "Staf", trainingCount: 1.5 }] }).success).toBe(false);
  });

  it("audienceSource hanya manual | auto", () => {
    expect(categoryCreateSchema.safeParse({ ...base, audienceSource: "auto" }).success).toBe(true);
    expect(categoryCreateSchema.safeParse({ ...base, audienceSource: "otomatis" }).success).toBe(false);
  });

  it("galeri imageIds maksimal 4 dan tidak boleh dobel", () => {
    const ids = ["0199b4d0-0000-7000-8000-00000000000a", "0199b4d0-0000-7000-8000-00000000000b"];
    expect(categoryCreateSchema.safeParse({ ...base, imageIds: ids }).success).toBe(true);
    expect(
      categoryCreateSchema.safeParse({
        ...base,
        imageIds: [
          "0199b4d0-0000-7000-8000-00000000000a",
          "0199b4d0-0000-7000-8000-00000000000b",
          "0199b4d0-0000-7000-8000-00000000000c",
          "0199b4d0-0000-7000-8000-00000000000d",
          "0199b4d0-0000-7000-8000-00000000000e",
        ],
      }).success,
    ).toBe(false);
    expect(categoryCreateSchema.safeParse({ ...base, imageIds: [ids[0], ids[0]] }).success).toBe(false);
  });
});

describe("categoryUpdateSchema", () => {
  it("menerima perubahan sebagian field baru", () => {
    const parsed = categoryUpdateSchema.parse({ summary: "Ringkas", audienceSource: "auto" });
    expect(parsed).toMatchObject({ summary: "Ringkas", audienceSource: "auto" });
  });

  it("menolak payload kosong", () => {
    expect(categoryUpdateSchema.safeParse({}).success).toBe(false);
  });
});

describe("publicCategoryTrainingsQuerySchema", () => {
  it("default halaman 1 tanpa q; nilai tidak valid diabaikan", () => {
    expect(publicCategoryTrainingsQuerySchema.parse({})).toEqual({ hal: 1, q: undefined });
    expect(publicCategoryTrainingsQuerySchema.parse({ hal: "3", q: "  audit " })).toEqual({ hal: 3, q: "audit" });
    expect(publicCategoryTrainingsQuerySchema.parse({ hal: "-1", q: "x".repeat(101) })).toEqual({ hal: 1, q: undefined });
    expect(publicCategoryTrainingsQuerySchema.parse({ hal: "abc", q: " " })).toEqual({ hal: 1, q: undefined });
  });
});
