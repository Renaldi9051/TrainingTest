import { z } from "zod";
import type { HomeSectionType } from "@/generated/prisma/client";
import { type TypedMediaRef } from "@/lib/media-refs";
import { contentHrefSchema, ctaSchema, idSchema, nullableText, plainText, requiredText } from "@/lib/validators/common";
import {
  headingFields,
  INTRO_MAX,
  requireManualIds,
  selectionFields,
  visionMissionFields,
} from "@/lib/validators/content-common";

// Isi section beranda (HomeSection.content), divalidasi per type. Section berbasis data
// (SERVICES, CATEGORIES, LATEST_TRAININGS, UPCOMING_SCHEDULES, CLIENTS, TESTIMONIALS) hanya
// menyimpan konfigurasi; datanya di-resolve saat GET /api/public/home.
// Semua href lewat ctaSchema (path internal, https, mailto, tel). Gambar: { mediaId }.

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

// Type yang hanya boleh ada satu di antara section yang belum dihapus (juga dijaga partial
// unique index HomeSection_single_type_key). CTA dibatasi karena section terbalik (hitam)
// maksimal 2 per halaman: CTA penutup + footer.
export const SINGLE_INSTANCE_TYPES = ["HERO", "CTA"] as const satisfies readonly HomeSectionType[];

// Type yang tidak lagi tampil di beranda (pemilik, 28 Okt 2026: beranda dipendekkan; testimoni 29 Okt). Baris lama
// tetap bisa dibuka & dihapus di admin, tapi tidak bisa dibuat baru dan tidak ikut beranda maupun
// pratinjau. Enum DB tidak diubah.
export const RETIRED_HOME_SECTION_TYPES = ["STATS", "SERVICES", "CATEGORIES", "MARQUEE", "TESTIMONIALS"] as const satisfies readonly HomeSectionType[];
export type RetiredHomeSectionType = (typeof RETIRED_HOME_SECTION_TYPES)[number];

export function isRetiredHomeSectionType(type: HomeSectionType): type is RetiredHomeSectionType {
  return (RETIRED_HOME_SECTION_TYPES as readonly HomeSectionType[]).includes(type);
}

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

export const ROTATING_WORDS_MAX = 5;
export const MARQUEE_SOURCES = ["custom", "services"] as const;
export const MARQUEE_ITEMS_MIN = 2;
export const MARQUEE_ITEMS_MAX = 12;
export const MARQUEE_ITEM_MAX = 40;
export const MARQUEE_HEADING_MAX = 60;
export const STATS_MAX = 6;
// Beranda menampilkan paling banyak 6 pelatihan terbaru (pemilik, 28 Okt 2026; dulu 12).
export const LATEST_TRAININGS_MAX = 6;
export const HERO_SLIDES_MAX = 6;
export const HERO_INTERVAL_MIN_MS = 4000;
export const HERO_INTERVAL_MAX_MS = 10000;
export const HERO_INTERVAL_DEFAULT_MS = 6000;
// Kata kunci hero berganti tiap 1,5-5 detik (pemilik, 29 Okt 2026; dulu tetap 2 detik), terpisah dari slide.
export const HERO_WORD_INTERVAL_MIN_MS = 1500;
export const HERO_WORD_INTERVAL_MAX_MS = 5000;
export const HERO_WORD_INTERVAL_DEFAULT_MS = 2000;
export const HERO_LAYOUTS = ["fullbleed", "split"] as const;
export const HERO_PHOTO_STYLES = ["color", "grayscale"] as const;

const optionalCta = ctaSchema.nullable().default(null);
const intro = plainText("Pengantar", INTRO_MAX);

// Elemen dekoratif per section (DESIGN.md 6.2), bisa dimatikan admin. Data lama tanpa field ini =
// menyala.
const decor = z.boolean({ error: "Nilai elemen dekoratif tidak valid." }).default(true);

// Tautan opsional: "" = tanpa tautan.
const optionalContentHref = z.string().trim().default("").pipe(z.union([z.literal(""), contentHrefSchema]));

const focal = (label: string) =>
  z
    .number({ error: `${label} harus berupa angka.` })
    .min(0, { error: `${label} minimal 0.` })
    .max(100, { error: `${label} maksimal 100.` })
    .default(50);

// Satu slide hero (DESIGN.md 8.1). alt "" = memakai alt gambar di media library.
const heroSlideSchema = z.object({
  mediaId: idSchema,
  alt: plainText("Alt slide", 200),
  caption: plainText("Keterangan", 80),
  href: optionalContentHref,
  hudLabel: plainText("Label HUD", 40),
  // Titik fokus gambar (object-position) dalam persen.
  focalX: focal("Titik fokus horizontal"),
  focalY: focal("Titik fokus vertikal"),
});
export type HeroSlide = z.infer<typeof heroSlideSchema>;

// Data hero lama { image: { mediaId } | null } dibaca sebagai slides[0] / tanpa slide. Data di DB
// tidak ditulis ulang sampai admin menyimpan section ini.
export function legacyHeroToSlides(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value) || "slides" in value) return value;
  const { image, ...rest } = value as Record<string, unknown> & { image?: unknown };
  const mediaId = image && typeof image === "object" && "mediaId" in image ? image.mediaId : undefined;
  return { ...rest, slides: mediaId ? [{ mediaId }] : [] };
}

const heroFields = z.object({
  eyebrow: headingFields.eyebrow,
  headline: requiredText("Headline", 120),
  // Kata kunci yang berganti di headline (RotatingWord, Fase 4). Kosong = headline statis.
  rotatingWords: z
    .array(requiredText("Kata kunci", 30))
    .max(ROTATING_WORDS_MAX, { error: `Kata kunci maksimal ${ROTATING_WORDS_MAX}.` })
    .default([]),
  subheadline: plainText("Subjudul", 300),
  showSearch: z.boolean().default(true),
  searchPlaceholder: plainText("Placeholder pencarian", 80),
  primaryCta: optionalCta,
  secondaryCta: optionalCta,
  layout: z.enum(HERO_LAYOUTS, { error: "Layout hero tidak dikenal." }).default("fullbleed"),
  intervalMs: z
    .number({ error: "Interval harus berupa angka." })
    .int({ error: "Interval harus bilangan bulat." })
    .min(HERO_INTERVAL_MIN_MS, { error: "Interval minimal 4 detik." })
    .max(HERO_INTERVAL_MAX_MS, { error: "Interval maksimal 10 detik." })
    .default(HERO_INTERVAL_DEFAULT_MS),
  wordIntervalMs: z
    .number({ error: "Interval kata harus berupa angka." })
    .int({ error: "Interval kata harus bilangan bulat." })
    .min(HERO_WORD_INTERVAL_MIN_MS, { error: "Interval kata minimal 1,5 detik." })
    .max(HERO_WORD_INTERVAL_MAX_MS, { error: "Interval kata maksimal 5 detik." })
    .default(HERO_WORD_INTERVAL_DEFAULT_MS),
  photoStyle: z.enum(HERO_PHOTO_STYLES, { error: "Gaya foto tidak dikenal." }).default("color"),
  showViewfinder: z.boolean().default(true),
  // Badge berputar: teksnya konten, jadi default mati sampai admin mengisinya.
  showBadge: z.boolean().default(false),
  badgeText: plainText("Teks badge", 60),
  badgeHref: optionalContentHref,
  slides: z
    .array(heroSlideSchema)
    .max(HERO_SLIDES_MAX, { error: `Slide maksimal ${HERO_SLIDES_MAX}.` })
    .default([]),
  decor,
});

const heroContent = z.preprocess(
  legacyHeroToSlides,
  heroFields.superRefine((value, ctx) => {
    if (value.showBadge && !value.badgeText) {
      ctx.addIssue({ code: "custom", path: ["badgeText"], message: "Isi teks badge, atau matikan badge." });
    }
    if (value.showBadge && !value.badgeHref) {
      ctx.addIssue({ code: "custom", path: ["badgeHref"], message: "Isi tautan badge, atau matikan badge." });
    }
    const seen = new Set<string>();
    value.slides.forEach((slide, index) => {
      if (seen.has(slide.mediaId)) {
        ctx.addIssue({ code: "custom", path: ["slides", index, "mediaId"], message: "Gambar ini sudah dipakai di slide lain." });
      }
      seen.add(slide.mediaId);
    });
  }),
);

const statsContent = z.object({
  ...headingFields,
  decor,
  items: z
    .array(
      z.object({
        // Angka disimpan sebagai number supaya counter (Fase 4) bisa berjalan dari 0.
        value: z
          .number({ error: "Angka wajib diisi." })
          .min(0, { error: "Angka tidak boleh negatif." })
          .max(1_000_000_000, { error: "Angka terlalu besar." }),
        prefix: plainText("Awalan", 4),
        suffix: plainText("Akhiran", 8),
        label: requiredText("Label", 60),
      }),
    )
    .min(1, { error: "Isi minimal satu angka statistik." })
    .max(STATS_MAX, { error: `Statistik maksimal ${STATS_MAX} item.` }),
});

const servicesContent = z
  .object({ ...headingFields, intro, ...selectionFields({ defaultLimit: 4, maxLimit: 8 }), cta: optionalCta, decor })
  .superRefine(requireManualIds);

// auto = kategori unggulan (featured) yang punya pelatihan publik, urut sesuai urutan kategori.
const categoriesContent = z
  .object({ ...headingFields, intro, ...selectionFields({ defaultLimit: 12, maxLimit: 24 }), cta: optionalCta, decor })
  .superRefine(requireManualIds);

// auto = pelatihan publik dengan publishedAt terbaru.
const latestTrainingsContent = z
  .object({ ...headingFields, intro, ...selectionFields({ defaultLimit: 6, maxLimit: LATEST_TRAININGS_MAX }), cta: optionalCta, decor })
  .superRefine(requireManualIds);

// Isi tersimpan sebelum batas 6 (limit/ids sampai 12) dipotong saat dibaca, supaya section tidak
// dianggap rusak dan hilang dari beranda. Data di DB tidak ditulis ulang sampai admin menyimpan.
function clampStoredLatestTrainings(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const { limit, ids, ...rest } = value as Record<string, unknown>;
  return {
    ...rest,
    ...(limit === undefined ? {} : { limit: typeof limit === "number" ? Math.min(limit, LATEST_TRAININGS_MAX) : limit }),
    ...(ids === undefined ? {} : { ids: Array.isArray(ids) ? ids.slice(0, LATEST_TRAININGS_MAX) : ids }),
  };
}

// Selalu otomatis: sesi DIBUKA terdekat mulai hari ini (WIB) dari pelatihan publik.
const upcomingSchedulesContent = z.object({
  ...headingFields,
  intro,
  limit: z
    .number({ error: "Jumlah harus berupa angka." })
    .int({ error: "Jumlah harus bilangan bulat." })
    .min(1, { error: "Jumlah minimal 1." })
    .max(10, { error: "Jumlah maksimal 10." })
    .default(5),
  cta: optionalCta,
  decor,
});

const clientsContent = z
  .object({ ...headingFields, intro, ...selectionFields({ defaultLimit: 24, maxLimit: 48 }), decor })
  .superRefine(requireManualIds);

// Tanpa judul (keputusan pemilik, 29 Okt 2026): `heading` lama yang masih tersimpan dibuang saat dibaca.
const testimonialsContent = z
  .object({ eyebrow: headingFields.eyebrow, intro, ...selectionFields({ defaultLimit: 6, maxLimit: 12 }), decor })
  .superRefine(requireManualIds);

const visionMissionContent = z.object({ ...visionMissionFields, decor });

const ctaContent = z.object({
  eyebrow: headingFields.eyebrow,
  heading: requiredText("Judul", 120),
  body: plainText("Isi", 400),
  primaryCta: ctaSchema,
  secondaryCta: optionalCta,
  decor,
});

// Teks besar berjalan (VelocityMarquee): teks sendiri, atau judul layanan yang tayang (urut sesuai
// urutan layanan). heading hanya untuk pembaca layar (h2 sr-only).
const marqueeContent = z
  .object({
    heading: plainText("Judul untuk pembaca layar", MARQUEE_HEADING_MAX),
    source: z.enum(MARQUEE_SOURCES, { error: "Sumber teks tidak dikenal." }).default("custom"),
    items: z
      .array(requiredText("Teks", MARQUEE_ITEM_MAX))
      .max(MARQUEE_ITEMS_MAX, { error: `Teks maksimal ${MARQUEE_ITEMS_MAX}.` })
      .default([]),
    limit: z
      .number({ error: "Jumlah harus berupa angka." })
      .int({ error: "Jumlah harus bilangan bulat." })
      .min(MARQUEE_ITEMS_MIN, { error: `Jumlah minimal ${MARQUEE_ITEMS_MIN}.` })
      .max(MARQUEE_ITEMS_MAX, { error: `Jumlah maksimal ${MARQUEE_ITEMS_MAX}.` })
      .default(6),
    decor,
  })
  .superRefine((value, ctx) => {
    if (value.source === "custom" && value.items.length < MARQUEE_ITEMS_MIN) {
      ctx.addIssue({ code: "custom", path: ["items"], message: `Isi minimal ${MARQUEE_ITEMS_MIN} teks.` });
    }
  });

export const HOME_SECTION_CONTENT_SCHEMAS = {
  HERO: heroContent,
  STATS: statsContent,
  SERVICES: servicesContent,
  CATEGORIES: categoriesContent,
  LATEST_TRAININGS: latestTrainingsContent,
  UPCOMING_SCHEDULES: upcomingSchedulesContent,
  CLIENTS: clientsContent,
  VISION_MISSION: visionMissionContent,
  TESTIMONIALS: testimonialsContent,
  CTA: ctaContent,
  MARQUEE: marqueeContent,
} as const satisfies Record<HomeSectionType, z.ZodType>;

export type HomeSectionContentMap = {
  [K in HomeSectionType]: z.infer<(typeof HOME_SECTION_CONTENT_SCHEMAS)[K]>;
};

// { type, content } sebagai discriminated union: dipakai saat membuat section.
export const homeSectionContentSchema = z.discriminatedUnion(
  "type",
  [
    z.object({ type: z.literal("HERO"), content: heroContent }),
    z.object({ type: z.literal("STATS"), content: statsContent }),
    z.object({ type: z.literal("SERVICES"), content: servicesContent }),
    z.object({ type: z.literal("CATEGORIES"), content: categoriesContent }),
    z.object({ type: z.literal("LATEST_TRAININGS"), content: latestTrainingsContent }),
    z.object({ type: z.literal("UPCOMING_SCHEDULES"), content: upcomingSchedulesContent }),
    z.object({ type: z.literal("CLIENTS"), content: clientsContent }),
    z.object({ type: z.literal("VISION_MISSION"), content: visionMissionContent }),
    z.object({ type: z.literal("TESTIMONIALS"), content: testimonialsContent }),
    z.object({ type: z.literal("CTA"), content: ctaContent }),
    z.object({ type: z.literal("MARQUEE"), content: marqueeContent }),
  ],
  { error: "Tipe section tidak dikenal." },
);
export type HomeSectionContent = z.infer<typeof homeSectionContentSchema>;

const sectionMeta = {
  // Label internal di builder admin; tidak tampil di publik.
  title: nullableText("Label", 80),
  visible: z.boolean(),
};

export const homeSectionCreateSchema = homeSectionContentSchema
  .and(z.object({ title: sectionMeta.title.default(null), visible: sectionMeta.visible.default(true) }))
  .superRefine((value, ctx) => {
    if (isRetiredHomeSectionType(value.type)) {
      ctx.addIssue({ code: "custom", path: ["type"], message: "Section ini tidak lagi ditampilkan di beranda." });
    }
  });
export type HomeSectionCreateInput = z.infer<typeof homeSectionCreateSchema>;

// Type tidak bisa diubah setelah dibuat; content divalidasi terhadap type yang tersimpan
// (parseHomeSectionContent) di service.
export const homeSectionUpdateSchema = z
  .strictObject(
    {
      title: sectionMeta.title,
      visible: sectionMeta.visible.optional(),
      content: z.unknown().optional(),
    },
    { error: "Field tidak dikenal. Tipe section tidak bisa diubah." },
  )
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    error: "Tidak ada perubahan yang dikirim.",
  });
export type HomeSectionUpdateInput = z.infer<typeof homeSectionUpdateSchema>;

// TS tidak bisa mengkorelasikan HOME_SECTION_CONTENT_SCHEMAS[T] dengan HomeSectionContentMap[T]
// untuk T generik (keduanya diturunkan dari objek yang sama), jadi dipersempit sekali di sini.
function contentSchemaFor<T extends HomeSectionType>(type: T): z.ZodType<HomeSectionContentMap[T]> {
  return HOME_SECTION_CONTENT_SCHEMAS[type] as unknown as z.ZodType<HomeSectionContentMap[T]>;
}

export function parseHomeSectionContent<T extends HomeSectionType>(type: T, content: unknown): HomeSectionContentMap[T] {
  return contentSchemaFor(type).parse(content);
}

// Isi tersimpan dibaca ulang dengan skema yang sama; null = rusak/tidak valid (dilewati di publik).
export function safeParseHomeSectionContent<T extends HomeSectionType>(
  type: T,
  content: unknown,
): HomeSectionContentMap[T] | null {
  const stored = type === "LATEST_TRAININGS" ? clampStoredLatestTrainings(content) : content;
  const parsed = contentSchemaFor(type).safeParse(stored);
  return parsed.success ? parsed.data : null;
}

// Semua referensi media per type, dengan jenis yang diharapkan (untuk validasi saat simpan).
// Harus selalu sama dengan collectMediaRefs (dijaga test).
export function homeSectionMediaRefs(section: HomeSectionContent): TypedMediaRef[] {
  switch (section.type) {
    // Alt slide kosong = alt dari media library dipakai, jadi media itu wajib punya alt.
    case "HERO":
      return section.content.slides.map((slide, index) => ({
        path: `slides.${index}`,
        mediaId: slide.mediaId,
        kind: "image",
        requireAlt: slide.alt === "",
      }));
    case "STATS":
    case "SERVICES":
    case "CATEGORIES":
    case "LATEST_TRAININGS":
    case "UPCOMING_SCHEDULES":
    case "CLIENTS":
    case "VISION_MISSION":
    case "TESTIMONIALS":
    case "CTA":
    case "MARQUEE":
      return [];
  }
}
