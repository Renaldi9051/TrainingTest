import { z } from "zod";
import type { HomeSection, HomeSectionContentMap, HomeSectionType } from "@/lib/api/types";

// Logika builder beranda tanpa UI (diuji Vitest). Batas & aturan mengikuti
// BE/src/lib/validators/home-section.ts; BE tetap memvalidasi ulang saat simpan.

export const HOME_SECTION_TYPES = [
  "HERO",
  "STATS",
  "SERVICES",
  "CATEGORIES",
  "LATEST_TRAININGS",
  "UPCOMING_SCHEDULES",
  "CLIENTS",
  "VISION_MISSION",
  "TESTIMONIALS",
  "CTA",
  "MARQUEE",
] as const satisfies readonly HomeSectionType[];

export const SINGLE_INSTANCE_TYPES = ["HERO", "CTA"] as const satisfies readonly HomeSectionType[];

// Type yang tidak lagi tampil di beranda (beranda dipendekkan, 28 Okt 2026; testimoni 29 Okt). Baris lama masih bisa
// diubah & dihapus, tapi tidak bisa ditambah lagi; BE menolak pembuatannya.
export const RETIRED_HOME_SECTION_TYPES = ["STATS", "SERVICES", "CATEGORIES", "MARQUEE", "TESTIMONIALS"] as const satisfies readonly HomeSectionType[];

export function isRetiredHomeSectionType(type: HomeSectionType): boolean {
  return (RETIRED_HOME_SECTION_TYPES as readonly HomeSectionType[]).includes(type);
}

// Pilihan di menu "Tambah section".
export const ADDABLE_HOME_SECTION_TYPES = HOME_SECTION_TYPES.filter((type) => !isRetiredHomeSectionType(type));

export const HOME_SECTION_LABELS: Record<HomeSectionType, string> = {
  HERO: "Hero",
  STATS: "Statistik",
  SERVICES: "Layanan unggulan",
  CATEGORIES: "Kategori",
  LATEST_TRAININGS: "Pelatihan terbaru",
  UPCOMING_SCHEDULES: "Jadwal terdekat",
  CLIENTS: "Klien",
  VISION_MISSION: "Visi & misi",
  TESTIMONIALS: "Testimoni",
  CTA: "CTA penutup",
  MARQUEE: "Teks berjalan",
};

export const HOME_SECTION_DESCRIPTIONS: Record<HomeSectionType, string> = {
  HERO: "Headline besar, pencarian pelatihan, tombol CTA.",
  STATS: "Angka pencapaian, mis. jumlah trainer.",
  SERVICES: "Baris layanan bernomor dari modul Layanan.",
  CATEGORIES: "Chip kategori populer ke katalog.",
  LATEST_TRAININGS: "Kartu pelatihan terbaru atau pilihan.",
  UPCOMING_SCHEDULES: "Sesi terdekat yang masih dibuka.",
  CLIENTS: "Logo klien grayscale.",
  VISION_MISSION: "Visi dan misi ringkas, dua kolom.",
  TESTIMONIALS: "Kutipan peserta atau klien.",
  CTA: "Blok hitam penutup dengan ajakan konsultasi.",
  MARQUEE: "Teks besar yang bergerak mengikuti scroll, dari teks sendiri atau judul layanan.",
};

export const ROTATING_WORDS_MAX = 5;
export const STATS_MAX = 6;
// Hero slideshow (sama dengan BE, dijaga test "sinkron dengan BE").
export const HERO_SLIDES_MAX = 6;
export const HERO_INTERVAL_MIN_MS = 4000;
export const HERO_INTERVAL_MAX_MS = 10000;
export const HERO_INTERVAL_DEFAULT_MS = 6000;
export const MARQUEE_ITEMS_MIN = 2;
export const MARQUEE_ITEMS_MAX = 12;

// Batas jumlah item per section berbasis data (default, maksimal).
export const SELECTION_LIMITS = {
  SERVICES: { defaultLimit: 4, maxLimit: 8 },
  CATEGORIES: { defaultLimit: 12, maxLimit: 24 },
  LATEST_TRAININGS: { defaultLimit: 6, maxLimit: 6 },
  CLIENTS: { defaultLimit: 24, maxLimit: 48 },
  TESTIMONIALS: { defaultLimit: 6, maxLimit: 12 },
} as const;
export type SelectionSectionType = keyof typeof SELECTION_LIMITS;
export const UPCOMING_LIMIT_MAX = 10;

export function isSingleInstance(type: HomeSectionType): boolean {
  return (SINGLE_INSTANCE_TYPES as readonly HomeSectionType[]).includes(type);
}

// Type yang tidak bisa ditambah lagi + alasannya (tooltip menu "Tambah section").
export function unavailableTypes(sections: Pick<HomeSection, "type">[]): Partial<Record<HomeSectionType, string>> {
  const present = new Set(sections.map((section) => section.type));
  return Object.fromEntries(
    SINGLE_INSTANCE_TYPES.filter((type) => present.has(type)).map((type) => [
      type,
      `${HOME_SECTION_LABELS[type]} sudah ada. Beranda hanya boleh punya satu ${HOME_SECTION_LABELS[type]}.`,
    ]),
  );
}

const heading = { eyebrow: "", heading: "" };
// Elemen dekoratif menyala untuk section baru (DESIGN.md 6.2).
const decor = true;
const selection = (type: SelectionSectionType) => ({
  mode: "auto" as const,
  limit: SELECTION_LIMITS[type].defaultLimit,
  ids: [] as string[],
});

// Titik fokus slide hero dari klik di pratinjau gambar: persen 0-100 (bulat), dibatasi ke dalam gambar.
export function focalFromPoint(x: number, y: number, box: { left: number; top: number; width: number; height: number }): { focalX: number; focalY: number } {
  const percent = (value: number, size: number) => (size > 0 ? Math.round(Math.min(100, Math.max(0, (value / size) * 100))) : 50);
  return { focalX: percent(x - box.left, box.width), focalY: percent(y - box.top, box.height) };
}

// Isi awal saat menambah section (field wajib masih kosong, diisi admin sebelum simpan).
export function defaultContent<K extends HomeSectionType>(type: K): HomeSectionContentMap[K] {
  const content: { [T in HomeSectionType]: HomeSectionContentMap[T] } = {
    HERO: {
      eyebrow: "",
      headline: "",
      rotatingWords: [],
      subheadline: "",
      showSearch: true,
      searchPlaceholder: "",
      primaryCta: null,
      secondaryCta: null,
      layout: "fullbleed",
      intervalMs: HERO_INTERVAL_DEFAULT_MS,
      photoStyle: "color",
      showViewfinder: true,
      showBadge: false,
      badgeText: "",
      badgeHref: "",
      slides: [],
      decor,
    },
    STATS: { ...heading, items: [{ value: 0, prefix: "", suffix: "", label: "" }], decor },
    SERVICES: { ...heading, intro: "", ...selection("SERVICES"), cta: null, decor },
    CATEGORIES: { ...heading, intro: "", ...selection("CATEGORIES"), cta: null, decor },
    LATEST_TRAININGS: { ...heading, intro: "", ...selection("LATEST_TRAININGS"), cta: null, decor },
    UPCOMING_SCHEDULES: { ...heading, intro: "", limit: 5, cta: null, decor },
    CLIENTS: { ...heading, intro: "", ...selection("CLIENTS"), decor },
    VISION_MISSION: { eyebrow: "", vision: "", mission: [""], motto: "", decor },
    TESTIMONIALS: { eyebrow: "", intro: "", ...selection("TESTIMONIALS"), decor },
    CTA: { eyebrow: "", heading: "", body: "", primaryCta: { label: "", href: "" }, secondaryCta: null, decor },
    MARQUEE: { heading: "", source: "services", items: [], limit: 6, decor },
  };
  return content[type];
}

// Ringkasan satu baris di daftar builder.
export function sectionSummary(section: Pick<HomeSection, "type" | "content">): string {
  const content = section.content as Record<string, unknown> | null;
  if (!content) return "Isi perlu diperbarui";
  const text = (key: string) => (typeof content[key] === "string" ? (content[key] as string) : "");
  switch (section.type) {
    case "HERO":
      return text("headline");
    case "STATS":
      return text("heading") || `${(content.items as unknown[] | undefined)?.length ?? 0} angka`;
    case "VISION_MISSION":
      return text("vision").slice(0, 80);
    case "CTA":
      return text("heading");
    case "MARQUEE":
      return content.source === "services"
        ? `Judul layanan, ${content.limit as number}`
        : ((content.items as string[] | undefined) ?? []).join(" · ").slice(0, 80);
    case "UPCOMING_SCHEDULES":
      return text("heading") || `${content.limit as number} sesi terdekat`;
    default: {
      const mode = content.mode === "manual" ? `${(content.ids as unknown[]).length} dipilih` : `Otomatis, ${content.limit as number}`;
      return text("heading") ? `${text("heading")} · ${mode}` : mode;
    }
  }
}

// ===== Validasi form (path error sama dengan BE: content.<field>) =====

// Sama dengan isContentHref di BE (BE/src/lib/validators/common.ts): path internal "/...",
// https://, mailto:, tel:. BE tetap menjadi penjaga akhir.
export function isContentHref(value: string): boolean {
  if (/[\s\u0000-\u001f\u007f]/.test(value)) return false;
  if (value.startsWith("/")) return !value.startsWith("//") && !value.includes("\\");
  if (/^https:\/\/[^/]+/i.test(value)) return true;
  if (/^mailto:[^@\s?]+@[^@\s?]+/i.test(value)) return true;
  return /^tel:\+?[0-9][0-9().-]{2,29}$/i.test(value);
}

export const CONTENT_HREF_ERROR =
  "Tautan harus path internal yang diawali / (mis. /pelatihan), https://, mailto:, atau tel:.";

const requiredText = (label: string, max: number) =>
  z
    .string()
    .trim()
    .min(1, { error: `${label} wajib diisi.` })
    .max(max, { error: `${label} maksimal ${max} karakter.` });
const optionalText = (label: string, max: number) =>
  z.string().trim().max(max, { error: `${label} maksimal ${max} karakter.` });

const cta = z.object({
  label: requiredText("Label tombol", 40),
  href: z
    .string()
    .trim()
    .min(1, { error: "Tautan wajib diisi." })
    .max(500, { error: "Tautan maksimal 500 karakter." })
    .refine(isContentHref, { error: CONTENT_HREF_ERROR }),
});
const headingFields = { eyebrow: optionalText("Eyebrow", 40), heading: optionalText("Judul", 120) };
const decorField = { decor: z.boolean() };
// Tautan opsional: kosong = tanpa tautan.
const optionalHref = z
  .string()
  .trim()
  .max(500, { error: "Tautan maksimal 500 karakter." })
  .refine((value) => value === "" || isContentHref(value), { error: CONTENT_HREF_ERROR });
const focal = (label: string) =>
  z
    .number({ error: `${label} harus berupa angka.` })
    .min(0, { error: `${label} minimal 0.` })
    .max(100, { error: `${label} maksimal 100.` });
const heroSlide = z.object({
  mediaId: z.string().min(1, { error: "Pilih gambar." }),
  alt: optionalText("Alt slide", 200),
  caption: optionalText("Keterangan", 80),
  href: optionalHref,
  hudLabel: optionalText("Label HUD", 40),
  focalX: focal("Titik fokus horizontal"),
  focalY: focal("Titik fokus vertikal"),
});
const intro = optionalText("Pengantar", 300);
const limit = (max: number) =>
  z
    .number({ error: "Jumlah harus berupa angka." })
    .int({ error: "Jumlah harus bilangan bulat." })
    .min(1, { error: "Jumlah minimal 1." })
    .max(max, { error: `Jumlah maksimal ${max}.` });

function selectionSchema(type: SelectionSectionType, extra: z.ZodRawShape, { withHeading = true } = {}) {
  const { maxLimit } = SELECTION_LIMITS[type];
  return z
    .object({
      ...(withHeading ? headingFields : { eyebrow: headingFields.eyebrow }),
      intro,
      mode: z.enum(["auto", "manual"]),
      limit: limit(maxLimit),
      ids: z.array(z.string()).max(maxLimit, { error: `Maksimal ${maxLimit} item.` }),
      ...extra,
      ...decorField,
    })
    .superRefine((value, ctx) => {
      if (value.mode === "manual" && value.ids.length === 0) {
        ctx.addIssue({ code: "custom", path: ["ids"], message: "Pilih minimal satu item untuk mode manual." });
      }
    });
}

export const HOME_CONTENT_FORM_SCHEMAS = {
  HERO: z.object({
    eyebrow: optionalText("Eyebrow", 40),
    headline: requiredText("Headline", 120),
    rotatingWords: z
      .array(requiredText("Kata kunci", 30))
      .max(ROTATING_WORDS_MAX, { error: `Kata kunci maksimal ${ROTATING_WORDS_MAX}.` }),
    subheadline: optionalText("Subjudul", 300),
    showSearch: z.boolean(),
    searchPlaceholder: optionalText("Placeholder pencarian", 80),
    primaryCta: cta.nullable(),
    secondaryCta: cta.nullable(),
    layout: z.enum(["fullbleed", "split"]),
    intervalMs: z
      .number({ error: "Interval harus berupa angka." })
      .int({ error: "Interval harus bilangan bulat." })
      .min(HERO_INTERVAL_MIN_MS, { error: "Interval minimal 4 detik." })
      .max(HERO_INTERVAL_MAX_MS, { error: "Interval maksimal 10 detik." }),
    photoStyle: z.enum(["color", "grayscale"]),
    showViewfinder: z.boolean(),
    showBadge: z.boolean(),
    badgeText: optionalText("Teks badge", 60),
    badgeHref: optionalHref,
    slides: z.array(heroSlide).max(HERO_SLIDES_MAX, { error: `Slide maksimal ${HERO_SLIDES_MAX}.` }),
    ...decorField,
  }).superRefine((value, ctx) => {
    if (value.showBadge && !value.badgeText.trim()) {
      ctx.addIssue({ code: "custom", path: ["badgeText"], message: "Isi teks badge, atau matikan badge." });
    }
    if (value.showBadge && !value.badgeHref.trim()) {
      ctx.addIssue({ code: "custom", path: ["badgeHref"], message: "Isi tautan badge, atau matikan badge." });
    }
  }),
  STATS: z.object({
    ...headingFields,
    ...decorField,
    items: z
      .array(
        z.object({
          value: z
            .number({ error: "Angka wajib diisi." })
            .min(0, { error: "Angka tidak boleh negatif." })
            .max(1_000_000_000, { error: "Angka terlalu besar." }),
          prefix: optionalText("Awalan", 4),
          suffix: optionalText("Akhiran", 8),
          label: requiredText("Label", 60),
        }),
      )
      .min(1, { error: "Isi minimal satu angka statistik." })
      .max(STATS_MAX, { error: `Statistik maksimal ${STATS_MAX} item.` }),
  }),
  SERVICES: selectionSchema("SERVICES", { cta: cta.nullable() }),
  CATEGORIES: selectionSchema("CATEGORIES", { cta: cta.nullable() }),
  LATEST_TRAININGS: selectionSchema("LATEST_TRAININGS", { cta: cta.nullable() }),
  UPCOMING_SCHEDULES: z.object({ ...headingFields, intro, limit: limit(UPCOMING_LIMIT_MAX), cta: cta.nullable(), ...decorField }),
  CLIENTS: selectionSchema("CLIENTS", {}),
  VISION_MISSION: z.object({
    eyebrow: optionalText("Eyebrow", 40),
    vision: requiredText("Visi", 600),
    mission: z.array(requiredText("Misi", 300)).min(1, { error: "Isi minimal satu misi." }).max(10),
    motto: optionalText("Moto", 200),
    ...decorField,
  }),
  TESTIMONIALS: selectionSchema("TESTIMONIALS", {}, { withHeading: false }),
  CTA: z.object({
    eyebrow: optionalText("Eyebrow", 40),
    heading: requiredText("Judul", 120),
    body: optionalText("Isi", 400),
    primaryCta: cta,
    secondaryCta: cta.nullable(),
    ...decorField,
  }),
  MARQUEE: z
    .object({
      heading: optionalText("Judul untuk pembaca layar", 60),
      source: z.enum(["custom", "services"]),
      items: z.array(requiredText("Teks", 40)).max(MARQUEE_ITEMS_MAX, { error: `Teks maksimal ${MARQUEE_ITEMS_MAX}.` }),
      limit: z
        .number({ error: "Jumlah harus berupa angka." })
        .int({ error: "Jumlah harus bilangan bulat." })
        .min(MARQUEE_ITEMS_MIN, { error: `Jumlah minimal ${MARQUEE_ITEMS_MIN}.` })
        .max(MARQUEE_ITEMS_MAX, { error: `Jumlah maksimal ${MARQUEE_ITEMS_MAX}.` }),
      ...decorField,
    })
    .superRefine((value, ctx) => {
      if (value.source === "custom" && value.items.length < MARQUEE_ITEMS_MIN) {
        ctx.addIssue({ code: "custom", path: ["items"], message: `Isi minimal ${MARQUEE_ITEMS_MIN} teks.` });
      }
    }),
} satisfies Record<HomeSectionType, z.ZodType>;

export function sectionFormSchema(type: HomeSectionType) {
  return z.object({
    title: z.string().trim().max(80, { error: "Label maksimal 80 karakter." }),
    visible: z.boolean(),
    content: HOME_CONTENT_FORM_SCHEMAS[type],
  });
}
