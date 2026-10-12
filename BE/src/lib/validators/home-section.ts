import { z } from "zod";
import type { HomeSectionType } from "@/generated/prisma/client";
import { mediaRefObjectSchema, type TypedMediaRef } from "@/lib/media-refs";
import { ctaSchema, nullableText, plainText, requiredText } from "@/lib/validators/common";
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
] as const satisfies readonly HomeSectionType[];

// Type yang hanya boleh ada satu di antara section yang belum dihapus (juga dijaga partial
// unique index HomeSection_single_type_key). CTA dibatasi karena section terbalik (hitam)
// maksimal 2 per halaman: CTA penutup + footer.
export const SINGLE_INSTANCE_TYPES = ["HERO", "CTA"] as const satisfies readonly HomeSectionType[];

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
};

export const ROTATING_WORDS_MAX = 5;
export const STATS_MAX = 6;

const optionalCta = ctaSchema.nullable().default(null);
const intro = plainText("Pengantar", INTRO_MAX);

const heroContent = z.object({
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
  image: mediaRefObjectSchema.nullable().default(null),
});

const statsContent = z.object({
  ...headingFields,
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
  .object({ ...headingFields, intro, ...selectionFields({ defaultLimit: 4, maxLimit: 8 }), cta: optionalCta })
  .superRefine(requireManualIds);

// auto = kategori unggulan (featured) yang punya pelatihan publik, urut sesuai urutan kategori.
const categoriesContent = z
  .object({ ...headingFields, intro, ...selectionFields({ defaultLimit: 12, maxLimit: 24 }), cta: optionalCta })
  .superRefine(requireManualIds);

// auto = pelatihan publik dengan publishedAt terbaru.
const latestTrainingsContent = z
  .object({ ...headingFields, intro, ...selectionFields({ defaultLimit: 6, maxLimit: 12 }), cta: optionalCta })
  .superRefine(requireManualIds);

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
});

const clientsContent = z
  .object({ ...headingFields, intro, ...selectionFields({ defaultLimit: 24, maxLimit: 48 }) })
  .superRefine(requireManualIds);

const testimonialsContent = z
  .object({ ...headingFields, intro, ...selectionFields({ defaultLimit: 6, maxLimit: 12 }) })
  .superRefine(requireManualIds);

const visionMissionContent = z.object(visionMissionFields);

const ctaContent = z.object({
  eyebrow: headingFields.eyebrow,
  heading: requiredText("Judul", 120),
  body: plainText("Isi", 400),
  primaryCta: ctaSchema,
  secondaryCta: optionalCta,
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
  ],
  { error: "Tipe section tidak dikenal." },
);
export type HomeSectionContent = z.infer<typeof homeSectionContentSchema>;

const sectionMeta = {
  // Label internal di builder admin; tidak tampil di publik.
  title: nullableText("Label", 80),
  visible: z.boolean(),
};

export const homeSectionCreateSchema = homeSectionContentSchema.and(
  z.object({ title: sectionMeta.title.default(null), visible: sectionMeta.visible.default(true) }),
);
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
  const parsed = contentSchemaFor(type).safeParse(content);
  return parsed.success ? parsed.data : null;
}

// Semua referensi media per type, dengan jenis yang diharapkan (untuk validasi saat simpan).
// Harus selalu sama dengan collectMediaRefs (dijaga test).
export function homeSectionMediaRefs(section: HomeSectionContent): TypedMediaRef[] {
  switch (section.type) {
    case "HERO":
      return section.content.image
        ? [{ path: "image", mediaId: section.content.image.mediaId, kind: "image" }]
        : [];
    case "STATS":
    case "SERVICES":
    case "CATEGORIES":
    case "LATEST_TRAININGS":
    case "UPCOMING_SCHEDULES":
    case "CLIENTS":
    case "VISION_MISSION":
    case "TESTIMONIALS":
    case "CTA":
      return [];
  }
}
