import { describe, expect, it } from "vitest";
import { collectMediaRefs } from "@/lib/media-refs";
import {
  HOME_SECTION_CONTENT_SCHEMAS,
  HOME_SECTION_TYPES,
  homeSectionContentSchema,
  homeSectionCreateSchema,
  homeSectionMediaRefs,
  homeSectionUpdateSchema,
  parseHomeSectionContent,
  safeParseHomeSectionContent,
  SINGLE_INSTANCE_TYPES,
} from "@/lib/validators/home-section";

const ID_A = "0199b4d0-0000-7000-8000-00000000000a";
const ID_B = "0199b4d0-0000-7000-8000-00000000000b";
const MEDIA = "0199b4d0-0000-7000-8000-0000000000aa";

// Contoh isi terlengkap per type (semua field, termasuk media) untuk test kesesuaian ekstraktor.
const FULL: Record<(typeof HOME_SECTION_TYPES)[number], unknown> = {
  HERO: {
    eyebrow: "Training provider",
    headline: "Ubah tim jadi lebih tangguh",
    rotatingWords: ["judul", "gambar", "jadwal"],
    subheadline: "Pelatihan in-house dan publik.",
    showSearch: true,
    searchPlaceholder: "Cari pelatihan",
    primaryCta: { label: "Lihat pelatihan", href: "/pelatihan" },
    secondaryCta: { label: "Hubungi kami", href: "mailto:halo@example.com" },
    image: { mediaId: MEDIA },
  },
  STATS: { eyebrow: "", heading: "Angka", items: [{ value: 100, prefix: "", suffix: "+", label: "Trainer" }] },
  SERVICES: { heading: "Layanan", mode: "manual", ids: [ID_A, ID_B], limit: 4, cta: { label: "Semua", href: "/layanan" } },
  CATEGORIES: { mode: "auto", limit: 12 },
  LATEST_TRAININGS: { mode: "auto", limit: 6, cta: { label: "Katalog", href: "/pelatihan" } },
  UPCOMING_SCHEDULES: { limit: 5, cta: { label: "Semua jadwal", href: "/jadwal" } },
  CLIENTS: { mode: "manual", ids: [ID_A] },
  VISION_MISSION: { vision: "Menjadi mitra belajar.", mission: ["Satu", "Dua"], motto: "Belajar terus" },
  TESTIMONIALS: { mode: "auto", limit: 6 },
  CTA: {
    heading: "Butuh pelatihan khusus?",
    body: "Konsultasikan kebutuhan tim Anda.",
    primaryCta: { label: "Chat WhatsApp", href: "https://wa.me/6281234567890" },
    secondaryCta: { label: "Telepon", href: "tel:+62215550101" },
  },
  MARQUEE: { heading: "Bidang pelatihan", source: "custom", items: ["BNSP", "In House", "Public Training"], limit: 6 },
};

describe("skema per type", () => {
  it("setiap type punya skema dan contoh lengkap yang valid", () => {
    for (const type of HOME_SECTION_TYPES) {
      const result = homeSectionContentSchema.safeParse({ type, content: FULL[type] });
      expect(result.success, `${type}: ${JSON.stringify(result.error?.issues)}`).toBe(true);
    }
  });

  it("isi minimal memakai default", () => {
    expect(parseHomeSectionContent("SERVICES", {})).toEqual({
      eyebrow: "",
      heading: "",
      intro: "",
      mode: "auto",
      limit: 4,
      ids: [],
      cta: null,
    });
    expect(parseHomeSectionContent("HERO", { headline: "Halo" })).toMatchObject({
      headline: "Halo",
      rotatingWords: [],
      showSearch: true,
      primaryCta: null,
      image: null,
    });
    expect(parseHomeSectionContent("UPCOMING_SCHEDULES", {})).toMatchObject({ limit: 5, cta: null });
    // Dari judul layanan: tanpa teks sendiri tetap valid.
    expect(parseHomeSectionContent("MARQUEE", { source: "services" })).toEqual({ heading: "", source: "services", items: [], limit: 6 });
  });

  it("type tidak dikenal ditolak", () => {
    expect(homeSectionContentSchema.safeParse({ type: "SLIDER", content: {} }).success).toBe(false);
  });

  it("section berbasis data tidak menyimpan salinan data (field tak dikenal dibuang)", () => {
    const parsed = parseHomeSectionContent("SERVICES", {
      mode: "manual",
      ids: [ID_A],
      items: [{ title: "Salinan layanan" }],
    });
    expect(parsed).not.toHaveProperty("items");
  });
});

describe("validasi isi", () => {
  it.each([
    ["HERO tanpa headline", "HERO", {}, ["headline"]],
    ["HERO kata kunci > 5", "HERO", { headline: "x", rotatingWords: ["a", "b", "c", "d", "e", "f"] }, ["rotatingWords"]],
    [
      "HERO CTA javascript:",
      "HERO",
      { headline: "x", primaryCta: { label: "Klik", href: "javascript:alert(1)" } },
      ["primaryCta", "href"],
    ],
    [
      "HERO CTA data:",
      "HERO",
      { headline: "x", secondaryCta: { label: "Klik", href: "data:text/html,x" } },
      ["secondaryCta", "href"],
    ],
    ["HERO gambar bukan uuid", "HERO", { headline: "x", image: { mediaId: "logo.png" } }, ["image", "mediaId"]],
    ["STATS kosong", "STATS", { items: [] }, ["items"]],
    ["STATS angka negatif", "STATS", { items: [{ value: -1, label: "x" }] }, ["items", 0, "value"]],
    ["STATS > 6", "STATS", { items: Array.from({ length: 7 }, () => ({ value: 1, label: "x" })) }, ["items"]],
    ["SERVICES manual tanpa pilihan", "SERVICES", { mode: "manual", ids: [] }, ["ids"]],
    ["MARQUEE teks sendiri < 2", "MARQUEE", { source: "custom", items: ["BNSP"] }, ["items"]],
    ["MARQUEE teks > 40 karakter", "MARQUEE", { items: ["a", "x".repeat(41)] }, ["items", 1]],
    ["MARQUEE teks > 12", "MARQUEE", { items: Array.from({ length: 13 }, (_, i) => `t${i}`) }, ["items"]],
    ["MARQUEE jumlah layanan > 12", "MARQUEE", { source: "services", limit: 13 }, ["limit"]],
    ["MARQUEE sumber asing", "MARQUEE", { source: "kategori" }, ["source"]],
    ["SERVICES id dobel", "SERVICES", { mode: "manual", ids: [ID_A, ID_A] }, ["ids"]],
    ["SERVICES limit > 8", "SERVICES", { limit: 9 }, ["limit"]],
    ["SERVICES limit pecahan", "SERVICES", { limit: 2.5 }, ["limit"]],
    ["SERVICES mode asing", "SERVICES", { mode: "random" }, ["mode"]],
    ["CLIENTS id bukan uuid", "CLIENTS", { mode: "manual", ids: ["klien-1"] }, ["ids", 0]],
    [
      "LATEST_TRAININGS CTA javascript:",
      "LATEST_TRAININGS",
      { cta: { label: "Semua", href: "JAVASCRIPT:alert(1)" } },
      ["cta", "href"],
    ],
    [
      "UPCOMING_SCHEDULES CTA data:",
      "UPCOMING_SCHEDULES",
      { cta: { label: "Semua", href: "data:text/html,x" } },
      ["cta", "href"],
    ],
    ["UPCOMING_SCHEDULES limit > 10", "UPCOMING_SCHEDULES", { limit: 11 }, ["limit"]],
    ["VISION_MISSION tanpa misi", "VISION_MISSION", { vision: "x", mission: [] }, ["mission"]],
    ["CTA tanpa tombol utama", "CTA", { heading: "x" }, ["primaryCta"]],
    [
      "CTA tombol utama javascript:",
      "CTA",
      { heading: "x", primaryCta: { label: "Klik", href: "javascript:void(0)" } },
      ["primaryCta", "href"],
    ],
  ] as const)("%s", (_label, type, content, path) => {
    const result = HOME_SECTION_CONTENT_SCHEMAS[type].safeParse(content);
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path)).toContainEqual(path);
  });

  it("pesan error dalam Bahasa Indonesia", () => {
    const result = HOME_SECTION_CONTENT_SCHEMAS.SERVICES.safeParse({ mode: "manual" });
    expect(result.error?.issues[0]?.message).toBe("Pilih minimal satu item untuk mode manual.");
  });
});

describe("create & update", () => {
  it("create: default label null dan visible true", () => {
    expect(homeSectionCreateSchema.parse({ type: "CATEGORIES", content: {} })).toMatchObject({
      type: "CATEGORIES",
      title: null,
      visible: true,
    });
  });

  it("create: isi divalidasi sesuai type", () => {
    expect(homeSectionCreateSchema.safeParse({ type: "CTA", content: {} }).success).toBe(false);
  });

  it("update: type tidak bisa diubah", () => {
    const result = homeSectionUpdateSchema.safeParse({ type: "HERO", visible: false });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Field tidak dikenal. Tipe section tidak bisa diubah.");
  });

  it("update: minimal satu perubahan", () => {
    expect(homeSectionUpdateSchema.safeParse({}).success).toBe(false);
    expect(homeSectionUpdateSchema.parse({ visible: false })).toEqual({ visible: false });
  });

  it("HERO dan CTA adalah type satu instance", () => {
    expect([...SINGLE_INSTANCE_TYPES]).toEqual(["HERO", "CTA"]);
  });
});

describe("safeParseHomeSectionContent", () => {
  it("isi tersimpan yang rusak menghasilkan null, bukan error", () => {
    expect(safeParseHomeSectionContent("CTA", { heading: 1 })).toBeNull();
    expect(safeParseHomeSectionContent("CLIENTS", {})).toMatchObject({ mode: "auto" });
  });
});

describe("homeSectionMediaRefs", () => {
  it("sama dengan pencarian generik key mediaId untuk setiap type", () => {
    for (const type of HOME_SECTION_TYPES) {
      const section = homeSectionContentSchema.parse({ type, content: FULL[type] });
      const typed = homeSectionMediaRefs(section).map(({ path, mediaId }) => ({ path, mediaId }));
      expect(typed, type).toEqual(collectMediaRefs(section.content));
    }
  });

  it("gambar hero bertipe image dan wajib alt", () => {
    const section = homeSectionContentSchema.parse({ type: "HERO", content: FULL.HERO });
    expect(homeSectionMediaRefs(section)).toEqual([
      { path: "image", mediaId: MEDIA, kind: "image", requireAlt: true },
    ]);
  });
});
