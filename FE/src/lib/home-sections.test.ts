import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { indexesFromFieldKeys } from "@/lib/form-errors";
import {
  ADDABLE_HOME_SECTION_TYPES,
  defaultContent,
  focalFromPoint,
  HERO_INTERVAL_DEFAULT_MS,
  HERO_INTERVAL_MAX_MS,
  HERO_INTERVAL_MIN_MS,
  HERO_SLIDES_MAX,
  HOME_SECTION_TYPES,
  isContentHref,
  RETIRED_HOME_SECTION_TYPES,
  ROTATING_WORDS_MAX,
  SELECTION_LIMITS,
  sectionFormSchema,
  sectionSummary,
  STATS_MAX,
  unavailableTypes,
} from "@/lib/home-sections";

const be = readFileSync(path.resolve(__dirname, "../../../BE/src/lib/validators/home-section.ts"), "utf8");

describe("sinkron dengan BE", () => {
  it("batas kata kunci, statistik, dan limit pilihan", () => {
    expect(be).toMatch(new RegExp(`export const ROTATING_WORDS_MAX = ${ROTATING_WORDS_MAX};`));
    expect(be).toMatch(new RegExp(`export const STATS_MAX = ${STATS_MAX};`));
    expect(be).toContain(`export const HERO_SLIDES_MAX = ${HERO_SLIDES_MAX};`);
    expect(be).toContain(`export const HERO_INTERVAL_MIN_MS = ${HERO_INTERVAL_MIN_MS};`);
    expect(be).toContain(`export const HERO_INTERVAL_MAX_MS = ${HERO_INTERVAL_MAX_MS};`);
    expect(be).toContain(`export const HERO_INTERVAL_DEFAULT_MS = ${HERO_INTERVAL_DEFAULT_MS};`);
    // Batas pelatihan terbaru di BE ditulis sebagai konstanta (juga dipakai untuk memotong data lama).
    const latestMax = SELECTION_LIMITS.LATEST_TRAININGS.maxLimit;
    expect(be).toContain(`export const LATEST_TRAININGS_MAX = ${latestMax};`);
    const limits = be.replace("maxLimit: LATEST_TRAININGS_MAX", `maxLimit: ${latestMax}`);
    for (const { defaultLimit, maxLimit } of Object.values(SELECTION_LIMITS)) {
      expect(limits).toContain(`selectionFields({ defaultLimit: ${defaultLimit}, maxLimit: ${maxLimit} })`);
    }
  });

  it("type yang dipensiunkan sama dengan BE dan tidak ada di menu tambah", () => {
    expect(be).toContain(
      `export const RETIRED_HOME_SECTION_TYPES = [${RETIRED_HOME_SECTION_TYPES.map((type) => `"${type}"`).join(", ")}]`,
    );
    expect(ADDABLE_HOME_SECTION_TYPES).toEqual(["HERO", "LATEST_TRAININGS", "UPCOMING_SCHEDULES", "CLIENTS", "VISION_MISSION", "CTA"]);
  });
});

describe("HERO/CTA satu instance", () => {
  it("type yang sudah ada tidak bisa ditambah, dengan alasan", () => {
    expect(unavailableTypes([{ type: "HERO" }, { type: "STATS" }, { type: "STATS" }])).toEqual({
      HERO: "Hero sudah ada. Beranda hanya boleh punya satu Hero.",
    });
    expect(unavailableTypes([{ type: "CTA" }])).toHaveProperty("CTA");
    expect(unavailableTypes([])).toEqual({});
  });
});

describe("validasi form", () => {
  it.each(HOME_SECTION_TYPES)("%s: isi default punya bentuk yang dikenali skema", (type) => {
    const result = sectionFormSchema(type).safeParse({ title: "", visible: true, content: defaultContent(type) });
    // Field wajib masih kosong di isi default; yang dicek hanya tidak ada error tipe/bentuk.
    const issues = result.success ? [] : result.error.issues;
    expect(issues.every((issue) => issue.code === "too_small" || issue.code === "custom")).toBe(true);
  });

  it("teks berjalan: dari judul layanan valid tanpa teks; teks sendiri minimal 2 (error di content.items)", () => {
    const base = { title: "", visible: true };
    expect(sectionFormSchema("MARQUEE").safeParse({ ...base, content: defaultContent("MARQUEE") }).success).toBe(true);
    const custom = sectionFormSchema("MARQUEE").safeParse({
      ...base,
      content: { heading: "", source: "custom", items: ["BNSP"], limit: 6, decor: true },
    });
    expect(custom.error?.issues.map((issue) => issue.path.join("."))).toEqual(["content.items"]);
  });

  it("error baris statistik memakai path content.items.N.field", () => {
    const result = sectionFormSchema("STATS").safeParse({
      title: "",
      visible: true,
      content: { eyebrow: "", heading: "", items: [{ value: 1, prefix: "", suffix: "", label: "ok" }, { value: -1, prefix: "", suffix: "", label: "" }] },
    });
    const keys = result.error?.issues.map((issue) => issue.path.join(".")) ?? [];
    expect(keys).toEqual(expect.arrayContaining(["content.items.1.value", "content.items.1.label"]));
    expect(indexesFromFieldKeys("content.items", keys)).toEqual([1]);
  });

  it("kata kunci hero kosong -> content.rotatingWords.N", () => {
    const result = sectionFormSchema("HERO").safeParse({
      title: "",
      visible: true,
      content: { ...defaultContent("HERO"), headline: "Halo", rotatingWords: ["judul", ""] },
    });
    const keys = result.error?.issues.map((issue) => issue.path.join(".")) ?? [];
    expect(indexesFromFieldKeys("content.rotatingWords", keys)).toEqual([1]);
  });

  it("mode manual tanpa pilihan -> content.ids", () => {
    const result = sectionFormSchema("CLIENTS").safeParse({
      title: "",
      visible: true,
      content: { ...defaultContent("CLIENTS"), mode: "manual" },
    });
    expect(result.error?.issues.map((issue) => issue.path.join("."))).toEqual(["content.ids"]);
  });
});

describe("isContentHref (sama dengan BE)", () => {
  it.each(["/pelatihan", "https://example.com", "mailto:halo@example.com", "tel:+62215550101"])("menerima %s", (href) => {
    expect(isContentHref(href)).toBe(true);
  });
  it.each(["javascript:alert(1)", "data:text/html,x", "http://example.com", "//evil.example", "/\\evil", "tel:abc"])(
    "menolak %s",
    (href) => {
      expect(isContentHref(href)).toBe(false);
    },
  );
});

describe("sectionSummary", () => {
  it("ringkasan baris builder", () => {
    expect(sectionSummary({ type: "CLIENTS", content: { ...defaultContent("CLIENTS") } })).toBe("Otomatis, 24");
    expect(sectionSummary({ type: "SERVICES", content: { ...defaultContent("SERVICES"), heading: "Layanan", mode: "manual", ids: ["a", "b"] } })).toBe(
      "Layanan · 2 dipilih",
    );
    expect(sectionSummary({ type: "HERO", content: null })).toBe("Isi perlu diperbarui");
  });
});

describe("hero: slide & elemen dekoratif", () => {
  it("titik fokus dari klik di pratinjau: persen bulat, dibatasi 0-100", () => {
    const box = { left: 100, top: 50, width: 400, height: 200 };
    expect(focalFromPoint(300, 150, box)).toEqual({ focalX: 50, focalY: 50 });
    expect(focalFromPoint(100, 50, box)).toEqual({ focalX: 0, focalY: 0 });
    expect(focalFromPoint(900, -20, box)).toEqual({ focalX: 100, focalY: 0 });
    expect(focalFromPoint(10, 10, { left: 0, top: 0, width: 0, height: 0 })).toEqual({ focalX: 50, focalY: 50 });
  });

  it("section baru: decor menyala; hero tanpa slide, interval 6 detik, badge mati", () => {
    for (const type of HOME_SECTION_TYPES) expect(defaultContent(type), type).toHaveProperty("decor", true);
    expect(defaultContent("HERO")).toMatchObject({ slides: [], intervalMs: 6000, layout: "fullbleed", showBadge: false });
  });

  it("form hero: slide kosong valid; badge aktif wajib teks & tautan; interval 4-10 detik", () => {
    const base = { ...defaultContent("HERO"), headline: "Halo" };
    expect(sectionFormSchema("HERO").safeParse({ title: "", visible: true, content: base }).success).toBe(true);
    const issues = (content: object) =>
      sectionFormSchema("HERO")
        .safeParse({ title: "", visible: true, content: { ...base, ...content } })
        .error?.issues.map((issue) => issue.path.join("."));
    expect(issues({ showBadge: true })).toEqual(["content.badgeText", "content.badgeHref"]);
    expect(issues({ intervalMs: 3000 })).toEqual(["content.intervalMs"]);
    expect(issues({ slides: [{ mediaId: "m", alt: "", caption: "", href: "javascript:x", hudLabel: "", focalX: 50, focalY: 120 }] })).toEqual([
      "content.slides.0.href",
      "content.slides.0.focalY",
    ]);
  });
});
