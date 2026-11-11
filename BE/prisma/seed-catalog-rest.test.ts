import { describe, expect, it } from "vitest";
import {
  loadRestSources,
  pickRestCategory,
  planCatalogRest,
  planRecategorize,
  type RestCategory,
  type RestDbRow,
  type RestSource,
  titleKey,
  untouchedSinceSeed,
} from "./seed-catalog-rest";

const category = (slug: string, activeTrainings: number, extra: Partial<RestCategory> = {}): RestCategory => ({
  id: `id-${slug}`,
  slug,
  name: slug[0].toUpperCase() + slug.slice(1),
  keywords: [],
  order: 0,
  inMenu: false,
  activeTrainings,
  ...extra,
});

let nextId = 1;
const source = (slug: string, title: string, categorySlugs: string[], date = "2026-01-01T00:00:00"): RestSource => ({
  slug,
  categorySlugs,
  post: { id: nextId++, slug, title, categoryIds: [], date },
});

const trashed = (slug: string, updatedById: string | null = null): RestDbRow => ({
  id: `row-${slug}`,
  slug,
  deletedAt: new Date("2026-10-19T00:00:00Z"),
  updatedById,
});

describe("sisa katalog referensi", () => {
  it("pelatihan aktif tidak disentuh dan judul kembarnya dilewati", () => {
    const plan = planCatalogRest({
      sources: [
        source("training-audit-internal", "TRAINING AUDIT INTERNAL", ["audit"]),
        source("pelatihan-audit-internal", "PELATIHAN AUDIT INTERNAL", ["audit"]),
        source("training-audit-mutu", "TRAINING AUDIT MUTU", ["audit"]),
      ],
      categories: [category("audit", 10)],
      activeTitles: ["Training Audit Internal"],
      dbRows: [{ id: "a", slug: "training-audit-internal", deletedAt: null, updatedById: "admin" }],
    });
    expect(plan.picks.map((pick) => pick.slug)).toEqual(["training-audit-mutu"]);
    expect(plan.skipped.duplicate).toBe(1);
    expect(plan.summary).toEqual([{ slug: "audit", before: 10, after: 11 }]);
  });

  it("Sampah yang belum diubah admin dipulihkan, yang diubah/dihapus admin dibiarkan", () => {
    const plan = planCatalogRest({
      sources: [
        source("training-a", "TRAINING BUDGETING DASAR", ["finance"]),
        source("training-b", "TRAINING BUDGETING LANJUT", ["finance"]),
        source("training-c", "TRAINING TREASURY", ["finance"]),
      ],
      categories: [category("finance", 10)],
      activeTitles: [],
      dbRows: [trashed("training-a"), trashed("training-b", "admin")],
    });
    expect(plan.picks.map((pick) => [pick.slug, pick.source.kind])).toEqual([
      ["training-a", "restore"],
      ["training-c", "create"],
    ]);
    expect(plan.skipped.protectedRows).toBe(1);
  });

  it("hanya kategori yang tampil dan tidak di daftar lewati; satu kategori per pelatihan", () => {
    const plan = planCatalogRest({
      sources: [
        source("training-x", "TRAINING PERENCANAAN PAJAK", ["pajak", "accounting"]),
        source("training-y", "TRAINING PAJAK PENGHASILAN", ["perpajakan"]),
        source("training-z", "TRAINING TOPIK TANPA KATEGORI", ["kosong"]),
      ],
      categories: [category("pajak", 10), category("accounting", 10), category("perpajakan", 10), category("kosong", 0)],
      activeTitles: [],
      dbRows: [],
    });
    // perpajakan = kategori kembar yang dilewati (CATEGORY_FILL_SKIP), kosong = belum tampil di publik.
    expect(plan.picks.map((pick) => pick.slug)).toEqual(["training-x", "training-y"]);
    expect(plan.picks.every((pick) => pick.categorySlug === "pajak" || pick.categorySlug === "accounting")).toBe(true);
    expect(plan.picks.find((pick) => pick.slug === "training-y")?.categorySlug).toBe("pajak");
    expect(plan.skipped.noCategory).toBe(1);
  });

  it("judul kosong dilewati; baris yang bisa dipulihkan didahulukan dari judul kembar baru", () => {
    const plan = planCatalogRest({
      sources: [
        source("training-baru", "TRAINING ANALISIS RISIKO", ["audit"], "2026-11-01T00:00:00"),
        source("pelatihan-lama", "PELATIHAN ANALISIS RISIKO", ["audit"], "2020-01-01T00:00:00"),
        source("kosong", "<b> </b>", ["audit"]),
      ],
      categories: [category("audit", 10)],
      activeTitles: [],
      dbRows: [trashed("pelatihan-lama")],
    });
    expect(plan.picks.map((pick) => pick.slug)).toEqual(["pelatihan-lama"]);
    expect(plan.skipped).toEqual({ duplicate: 1, noCategory: 0, protectedRows: 0, untitled: 1 });
  });

  it("sumber: snapshot + tambahan, slug unik dan maks 120 karakter, kategori gabungan dipetakan", () => {
    const sources = loadRestSources();
    const slugs = sources.map((item) => item.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(slugs.every((slug) => slug.length > 0 && slug.length <= 120)).toBe(true);
    expect(sources.some((item) => item.categorySlugs.includes("teknik-elektrikal"))).toBe(false);
  });
});

describe("kunci judul kembar", () => {
  it("& / AND / DAN, kata sambung, Training/Pelatihan, dan urutan kata diabaikan", () => {
    expect(titleKey("Training Fire Prevention & Protection System")).toBe(titleKey("TRAINING FIRE PREVENTION AND PROTECTION SYSTEM"));
    expect(titleKey("TRAINING PURCHASING DAN MATERIAL REQUIREMENT PLANNING (MRP)")).toBe(
      titleKey("TRAINING PURCHASING AND MATERIAL REQUIREMENT PLANNING (MRP)"),
    );
    expect(titleKey("TRAINING MANAGEMENT RETAIL")).toBe(titleKey("TRAINING RETAIL MANAGEMENT"));
    expect(titleKey("AUDIT COMPUTER FORENSIC TRAINING")).toBe(titleKey("TRAINING AUDIT COMPUTER FORENSIC"));
    expect(titleKey("Pelatihan Shipping Management di Indonesia")).toBe(titleKey("TRAINING SHIPPING MANAGEMENT INDONESIA"));
  });

  it("angka dan kata lain tetap membedakan", () => {
    expect(titleKey("TRAINING SUPPLY CHAIN MANAGEMENT")).not.toBe(titleKey("TRAINING SUPPLY CHAIN MANAGEMENT 4.0"));
    expect(titleKey("TRAINING MANAJEMEN RISIKO")).not.toBe(titleKey("TRAINING MANAJEMEN RISIKO PROYEK"));
    expect(titleKey("<b> </b>")).toBe("");
  });

  it("rencana melewati judul yang hanya beda penulisan dengan pelatihan aktif atau sesama sumber", () => {
    const plan = planCatalogRest({
      sources: [
        source("t-fire", "TRAINING FIRE PREVENTION & PROTECTION SYSTEM", ["audit"]),
        source("t-retail-1", "TRAINING MANAGEMENT RETAIL", ["audit"], "2026-02-01T00:00:00"),
        source("t-retail-2", "PELATIHAN RETAIL AND MANAGEMENT", ["audit"]),
      ],
      categories: [category("audit", 10)],
      activeTitles: ["Pelatihan Fire Prevention and Protection System"],
      dbRows: [],
    });
    expect(plan.picks.map((pick) => pick.slug)).toEqual(["t-retail-1"]);
    expect(plan.skipped.duplicate).toBe(2);
  });
});

describe("kategori dari judul (versi 2)", () => {
  const accounting = category("accounting", 378, { inMenu: true });
  const customer = category("customer", 10);
  const cost = category("cost", 10);
  const costControl = category("cost-control", 10, { name: "Cost Control" });
  const humanResource = category("human-resource", 367, { name: "Human Resource", inMenu: true });
  const management = category("management", 273, { inMenu: true });
  const all = [accounting, customer, cost, costControl, humanResource, management];

  it("judul mengalahkan tag sumber yang tidak cocok", () => {
    expect(pickRestCategory("Pelatihan Customer Service Fundamentals", [accounting], all)?.slug).toBe("customer");
  });

  it("istilah cocok terpanjang = paling spesifik", () => {
    expect(pickRestCategory("TRAINING COST CONTROL AND REPORTING", [accounting], all)?.slug).toBe("cost-control");
  });

  it("kategori kata umum (management) tidak mengalahkan tag sumber; tanpa kecocokan judul pakai tag sumber", () => {
    expect(pickRestCategory("TRAINING TALENT MANAGEMENT", [humanResource], all)?.slug).toBe("human-resource");
    expect(pickRestCategory("TRAINING NEGOSIASI LANJUT", [accounting], all)?.slug).toBe("accounting");
  });

  it("audit: belum disentuh kalau sesudah entri seed hanya ada entri seed atau isi sampul/galeri", () => {
    const seed = { action: "UPDATE", diff: { categoryIds: { from: [], to: ["x"] }, source: "catalog-rest" } };
    const restore = { action: "RESTORE", diff: null };
    const photos = { action: "UPDATE", diff: { coverId: { from: null, to: "m" }, imageIds: { from: [], to: ["m"] } } };
    const adminEdit = { action: "UPDATE", diff: { title: { from: "a", to: "b" } } };
    expect(untouchedSinceSeed([restore, seed, photos])).toBe(true);
    expect(untouchedSinceSeed([restore, seed, photos, adminEdit])).toBe(false);
    expect(untouchedSinceSeed([restore, photos])).toBe(false);
    expect(untouchedSinceSeed([seed, { action: "DELETE", diff: null }])).toBe(false);
  });

  it("pindah hanya baris yang belum disentuh dan kategorinya berubah", () => {
    const sources = [
      source("pelatihan-customer", "Pelatihan Customer Service Fundamentals", ["accounting"]),
      source("training-akuntansi", "Training Accounting Dasar", ["accounting"]),
      source("training-diedit", "Training Customer Care", ["accounting"]),
    ];
    const row = (slug: string, title: string, untouched = true) => ({ id: `t-${slug}`, slug, title, categoryIds: [accounting.id], untouched });
    const moves = planRecategorize({
      rows: [
        row("pelatihan-customer", "Pelatihan Customer Service Fundamentals"),
        row("training-akuntansi", "Training Accounting Dasar"),
        row("training-diedit", "Training Customer Care", false),
      ],
      sources,
      categories: all,
    });
    expect(moves.map((move) => [move.slug, move.to.slug])).toEqual([["pelatihan-customer", "customer"]]);
  });
});
