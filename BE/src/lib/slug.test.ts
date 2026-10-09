import { describe, expect, it, vi } from "vitest";
import { HttpError } from "@/lib/http";
import {
  assertSlugAvailable,
  nextAvailableSlug,
  slugify,
  slugSchema,
  withSlugConflict,
  type SlugLookup,
} from "@/lib/slug";

describe("slugify", () => {
  it.each([
    ["Analisis Laporan Keuangan", "analisis-laporan-keuangan"],
    ["  Manajemen   Kinerja (KPI)  ", "manajemen-kinerja-kpi"],
    ["Café Résumé Naïve", "cafe-resume-naive"],
    ["Keuangan & Akuntansi", "keuangan-dan-akuntansi"],
    ["ISO 9001:2015 -- Dasar", "iso-9001-2015-dasar"],
    ["---", ""],
  ])("%s -> %s", (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });

  it("dibatasi 120 karakter tanpa tanda hubung di ujung", () => {
    const slug = slugify(`${"a".repeat(119)} bbb`);
    expect(slug.length).toBeLessThanOrEqual(120);
    expect(slug.endsWith("-")).toBe(false);
  });
});

describe("slugSchema", () => {
  it("menerima slug valid dan menolak huruf besar/spasi/tanda hubung ganda", () => {
    expect(slugSchema.parse("pelatihan-kpi-2")).toBe("pelatihan-kpi-2");
    for (const bad of ["Pelatihan", "a b", "a--b", "-a", "a-", ""]) {
      expect(slugSchema.safeParse(bad).success).toBe(false);
    }
  });
});

describe("cek bentrok slug", () => {
  it("query selalu memfilter deletedAt: null dan mengecualikan id sendiri", async () => {
    const findFirst = vi.fn<SlugLookup>().mockResolvedValue(null);
    await assertSlugAvailable(findFirst, "kpi", "id-1");
    expect(findFirst).toHaveBeenCalledWith({
      where: { slug: "kpi", deletedAt: null, id: { not: "id-1" } },
      select: { id: true },
    });
  });

  it("bentrok = HttpError 409 dengan fields.slug", async () => {
    const findFirst = vi.fn<SlugLookup>().mockResolvedValue({ id: "lain" });
    const error = await assertSlugAvailable(findFirst, "kpi").catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(HttpError);
    expect(error).toMatchObject({ status: 409, code: "SLUG_TAKEN" });
    expect((error as HttpError).fields?.slug?.[0]).toMatch(/sudah dipakai/);
  });

  it("nextAvailableSlug menambah sufiks angka sampai kosong", async () => {
    const taken = new Set(["kpi", "kpi-2"]);
    const findFirst: SlugLookup = async ({ where }) => (taken.has(where.slug) ? { id: "x" } : null);
    expect(await nextAvailableSlug(findFirst, "kpi")).toBe("kpi-3");
    expect(await nextAvailableSlug(findFirst, "baru")).toBe("baru");
  });

  it("P2002 dari unique index parsial diubah jadi 409 slug", async () => {
    const error = await withSlugConflict(async () => {
      throw Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
    }).catch((caught: unknown) => caught);
    expect(error).toMatchObject({ status: 409, code: "SLUG_TAKEN" });
  });
});
