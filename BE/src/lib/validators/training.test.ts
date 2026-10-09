import { describe, expect, it } from "vitest";
import {
  publicTrainingQuerySchema,
  trainingBulkSchema,
  trainingCreateSchema,
  trainingListQuerySchema,
  trainingUpdateSchema,
} from "@/lib/validators/training";

const CATEGORY = "0199b4d0-0000-7000-8000-000000000001";
const base = { title: "Analisis Laporan Keuangan", categoryIds: [CATEGORY] };

describe("trainingCreateSchema", () => {
  it("default: DRAFT, tanpa harga, SEO kosong", () => {
    expect(trainingCreateSchema.parse(base)).toMatchObject({
      title: "Analisis Laporan Keuangan",
      status: "DRAFT",
      publishedAt: null,
      showPrice: false,
      types: [],
      body: null,
      seo: { title: "", description: "", ogImageId: null },
    });
  });

  it("minimal 1 kategori dan judul wajib", () => {
    expect(trainingCreateSchema.safeParse({ ...base, categoryIds: [] }).success).toBe(false);
    expect(trainingCreateSchema.safeParse({ ...base, title: " " }).success).toBe(false);
  });

  it("tampilkan harga butuh teks investasi", () => {
    const result = trainingCreateSchema.safeParse({ ...base, showPrice: true, priceText: "" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["priceText"]);
    expect(trainingCreateSchema.safeParse({ ...base, showPrice: true, priceText: "Rp4.500.000" }).success).toBe(true);
  });

  it("tipe & metode dari daftar; tipe dobel digabung", () => {
    expect(trainingCreateSchema.parse({ ...base, types: ["PUBLIC", "PUBLIC", "IN_HOUSE"] }).types).toEqual([
      "PUBLIC",
      "IN_HOUSE",
    ]);
    expect(trainingCreateSchema.safeParse({ ...base, types: ["PRIVATE"] }).success).toBe(false);
    expect(trainingCreateSchema.safeParse({ ...base, method: "HYBRID" }).success).toBe(true);
    expect(trainingCreateSchema.safeParse({ ...base, method: "ONSITE" }).success).toBe(false);
  });

  it("publishedAt harus ISO dengan offset", () => {
    expect(trainingCreateSchema.parse({ ...base, publishedAt: "2026-11-01T09:00:00+07:00" }).publishedAt).toEqual(
      new Date("2026-11-01T02:00:00.000Z"),
    );
    expect(trainingCreateSchema.safeParse({ ...base, publishedAt: "besok" }).success).toBe(false);
  });

  it("rich text melewati allowlist (link javascript: ditolak)", () => {
    const evil = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "x", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }] }],
        },
      ],
    };
    expect(trainingCreateSchema.safeParse({ ...base, syllabus: evil }).success).toBe(false);
  });

  it("update kosong ditolak; update parsial diterima", () => {
    expect(trainingUpdateSchema.safeParse({}).success).toBe(false);
    expect(trainingUpdateSchema.parse({ title: "Baru" })).toMatchObject({ title: "Baru" });
  });
});

describe("trainingBulkSchema", () => {
  it("ganti kategori butuh categoryId; aksi lain ditolak", () => {
    expect(trainingBulkSchema.safeParse({ action: "set-category", ids: [CATEGORY] }).success).toBe(false);
    expect(trainingBulkSchema.safeParse({ action: "set-category", ids: [CATEGORY], categoryId: CATEGORY }).success).toBe(
      true,
    );
    expect(trainingBulkSchema.safeParse({ action: "archive", ids: [CATEGORY] }).success).toBe(false);
    expect(trainingBulkSchema.safeParse({ action: "publish", ids: [] }).success).toBe(false);
  });
});

describe("trainingListQuerySchema", () => {
  it("filter status termasuk SCHEDULED", () => {
    expect(trainingListQuerySchema.parse({ status: "SCHEDULED" }).status).toBe("SCHEDULED");
    expect(trainingListQuerySchema.parse({}).sort).toEqual({ field: "updatedAt", direction: "desc" });
  });
});

describe("publicTrainingQuerySchema", () => {
  it("membaca parameter URL katalog", () => {
    expect(
      publicTrainingQuerySchema.parse({
        q: " pajak ",
        kategori: "keuangan,pajak",
        metode: "online",
        tipe: "in-house",
        urut: "az",
        hal: "2",
      }),
    ).toEqual({ q: "pajak", kategori: ["keuangan", "pajak"], metode: "ONLINE", tipe: "IN_HOUSE", urut: "az", hal: 2, per: 24 });
  });

  it("nilai tidak dikenal diabaikan, bukan error", () => {
    expect(publicTrainingQuerySchema.parse({ metode: "teleport", tipe: "x", urut: "acak", hal: "-3" })).toMatchObject({
      metode: undefined,
      tipe: undefined,
      urut: undefined,
      hal: 1,
    });
  });
});
