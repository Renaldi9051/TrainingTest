import { z } from "zod";
import { contentStatusFilter, listQuerySchema } from "@/lib/list-query";
import { optionalRichTextSchema } from "@/lib/rich-text";
import { optionalSlugSchema } from "@/lib/slug";
import { iconSchema } from "@/lib/validators/category";
import {
  hasAnyField,
  idSchema,
  NO_CHANGES_ERROR,
  nullableText,
  plainText,
  requiredText,
  seoSchema,
} from "@/lib/validators/common";

export const SERVICE_TAGLINE_MAX = 120;
export const SERVICE_BENEFITS_MAX = 8;
export const SERVICE_FAQS_MAX = 12;
export const SERVICE_TRAININGS_MAX = 12;

// Benefit di detail layanan ("Yang Anda dapat"). Kosong = section disembunyikan.
export const serviceBenefitsSchema = z
  .array(
    z.object({
      icon: iconSchema.default(null),
      title: requiredText("Judul benefit", 80),
      description: plainText("Deskripsi benefit", 300),
    }),
  )
  .max(SERVICE_BENEFITS_MAX, { error: `Benefit maksimal ${SERVICE_BENEFITS_MAX} item.` });
export type ServiceBenefit = z.infer<typeof serviceBenefitsSchema>[number];

export const serviceFaqsSchema = z
  .array(z.object({ q: requiredText("Pertanyaan", 200), a: requiredText("Jawaban", 1000) }))
  .max(SERVICE_FAQS_MAX, { error: `FAQ maksimal ${SERVICE_FAQS_MAX} item.` });
export type ServiceFaq = z.infer<typeof serviceFaqsSchema>[number];

// Pelatihan terkait: pilihan manual (urutan dijaga). null = section disembunyikan.
export const serviceTrainingSelectionSchema = z
  .object({
    mode: z.literal("manual", { error: "Mode pelatihan terkait tidak dikenal." }),
    ids: z
      .array(idSchema)
      .min(1, { error: "Pilih minimal satu pelatihan." })
      .max(SERVICE_TRAININGS_MAX, { error: `Pelatihan terkait maksimal ${SERVICE_TRAININGS_MAX}.` })
      .refine((ids) => new Set(ids).size === ids.length, { error: "Pelatihan tidak boleh dobel." }),
  })
  .nullable();
export type ServiceTrainingSelection = z.infer<typeof serviceTrainingSelectionSchema>;

// Membaca kolom JSON dari DB dengan aman: data rusak jadi kosong, bukan error.
export function readServiceBenefits(value: unknown): ServiceBenefit[] {
  const parsed = serviceBenefitsSchema.safeParse(value);
  return parsed.success ? parsed.data : [];
}

export function readServiceFaqs(value: unknown): ServiceFaq[] {
  const parsed = serviceFaqsSchema.safeParse(value);
  return parsed.success ? parsed.data : [];
}

export function readServiceTrainingSelection(value: unknown): ServiceTrainingSelection {
  const parsed = serviceTrainingSelectionSchema.safeParse(value ?? null);
  return parsed.success ? parsed.data : null;
}

// Layanan (/layanan/[slug]). Ikon memakai daftar ikon kategori.
const serviceFields = {
  title: requiredText("Judul", 200),
  slug: optionalSlugSchema,
  // Label mono di bawah judul. Kosong = tidak tampil.
  tagline: nullableText("Tagline", SERVICE_TAGLINE_MAX),
  icon: iconSchema,
  summary: nullableText("Ringkasan", 300),
  body: optionalRichTextSchema,
  imageId: idSchema.nullable(),
  benefits: serviceBenefitsSchema,
  faqs: serviceFaqsSchema,
  trainingSelection: serviceTrainingSelectionSchema,
  status: z.enum(["DRAFT", "PUBLISHED"], { error: "Status tidak dikenal." }),
  seo: seoSchema,
};

export const serviceCreateSchema = z.object({
  ...serviceFields,
  tagline: serviceFields.tagline.default(null),
  icon: serviceFields.icon.default(null),
  summary: serviceFields.summary.default(null),
  body: serviceFields.body.default(null),
  imageId: serviceFields.imageId.default(null),
  benefits: serviceFields.benefits.default([]),
  faqs: serviceFields.faqs.default([]),
  trainingSelection: serviceFields.trainingSelection.default(null),
  status: serviceFields.status.default("DRAFT"),
  seo: seoSchema.default({ title: "", description: "", ogImageId: null }),
});
export type ServiceCreateInput = z.infer<typeof serviceCreateSchema>;

export const serviceUpdateSchema = z
  .object({
    title: serviceFields.title.optional(),
    slug: serviceFields.slug,
    tagline: serviceFields.tagline,
    icon: serviceFields.icon.optional(),
    summary: serviceFields.summary,
    body: serviceFields.body,
    imageId: serviceFields.imageId.optional(),
    // Tidak dikirim = nilai lama di DB tidak disentuh.
    benefits: serviceFields.benefits.optional(),
    faqs: serviceFields.faqs.optional(),
    trainingSelection: serviceFields.trainingSelection.optional(),
    status: serviceFields.status.optional(),
    seo: serviceFields.seo.optional(),
  })
  .refine(hasAnyField, { error: NO_CHANGES_ERROR });
export type ServiceUpdateInput = z.infer<typeof serviceUpdateSchema>;

export const SERVICE_SORT_FIELDS = ["order", "title", "updatedAt", "createdAt"] as const;

export const serviceListQuerySchema = listQuerySchema({
  sortFields: SERVICE_SORT_FIELDS,
  defaultSort: "order",
  // issue=no-image: layanan tanpa gambar ("perlu dibereskan" di dashboard).
  extra: { status: contentStatusFilter, issue: z.enum(["no-image"]).optional() },
});
export type ServiceListQuery = z.infer<typeof serviceListQuerySchema>;
