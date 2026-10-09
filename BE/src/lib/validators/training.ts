import { z } from "zod";
import { csvParam, listQuerySchema } from "@/lib/list-query";
import { optionalRichTextSchema } from "@/lib/rich-text";
import { optionalSlugSchema, slugSchema } from "@/lib/slug";
import { idSchema, idsSchema, nullableText, requiredText, seoSchema } from "@/lib/validators/common";

export const TRAINING_METHODS = ["ONLINE", "OFFLINE", "HYBRID"] as const;
export const TRAINING_TYPES = ["PUBLIC", "IN_HOUSE"] as const;

const methodSchema = z.enum(TRAINING_METHODS, { error: "Metode tidak dikenal." });
const typeSchema = z.enum(TRAINING_TYPES, { error: "Tipe tidak dikenal." });

const categoryIdsSchema = z
  .array(idSchema)
  .min(1, { error: "Pilih minimal satu kategori." })
  .max(20, { error: "Maksimal 20 kategori." })
  .transform((ids) => [...new Set(ids)]);

// publishedAt: ISO datetime dari form (datetime-local dikonversi FE ke ISO dengan zona WIB).
const publishedAtSchema = z.iso
  .datetime({ offset: true, error: "Waktu publish tidak valid." })
  .transform((value) => new Date(value))
  .nullable();

const trainingFields = {
  title: requiredText("Judul", 200),
  slug: optionalSlugSchema,
  summary: nullableText("Ringkasan", 500),
  body: optionalRichTextSchema,
  objectives: optionalRichTextSchema,
  syllabus: optionalRichTextSchema,
  audience: optionalRichTextSchema,
  facilities: optionalRichTextSchema,
  duration: nullableText("Durasi", 100),
  method: methodSchema.nullable(),
  types: z.array(typeSchema).max(10).transform((types) => [...new Set(types)]),
  priceText: nullableText("Investasi", 200),
  showPrice: z.boolean(),
  coverId: idSchema.nullable(),
  categoryIds: categoryIdsSchema,
  status: z.enum(["DRAFT", "PUBLISHED"], { error: "Status tidak dikenal." }),
  publishedAt: publishedAtSchema,
  seo: seoSchema,
};

const PRICE_REQUIRED = "Isi teks investasi atau matikan opsi tampilkan harga.";

export const trainingCreateSchema = z
  .object({
    ...trainingFields,
    summary: trainingFields.summary.default(null),
    body: trainingFields.body.default(null),
    objectives: trainingFields.objectives.default(null),
    syllabus: trainingFields.syllabus.default(null),
    audience: trainingFields.audience.default(null),
    facilities: trainingFields.facilities.default(null),
    duration: trainingFields.duration.default(null),
    method: trainingFields.method.default(null),
    types: trainingFields.types.default([]),
    priceText: trainingFields.priceText.default(null),
    showPrice: trainingFields.showPrice.default(false),
    coverId: trainingFields.coverId.default(null),
    status: trainingFields.status.default("DRAFT"),
    publishedAt: trainingFields.publishedAt.default(null),
    seo: seoSchema.default({ title: "", description: "", ogImageId: null }),
  })
  .refine((value) => !value.showPrice || Boolean(value.priceText), {
    error: PRICE_REQUIRED,
    path: ["priceText"],
  });
export type TrainingCreateInput = z.infer<typeof trainingCreateSchema>;

export const trainingUpdateSchema = z
  .object({
    title: trainingFields.title.optional(),
    slug: trainingFields.slug,
    summary: trainingFields.summary,
    body: trainingFields.body,
    objectives: trainingFields.objectives,
    syllabus: trainingFields.syllabus,
    audience: trainingFields.audience,
    facilities: trainingFields.facilities,
    duration: trainingFields.duration,
    method: trainingFields.method.optional(),
    types: trainingFields.types.optional(),
    priceText: trainingFields.priceText,
    showPrice: trainingFields.showPrice.optional(),
    coverId: trainingFields.coverId.optional(),
    categoryIds: trainingFields.categoryIds.optional(),
    status: trainingFields.status.optional(),
    publishedAt: trainingFields.publishedAt.optional(),
    seo: seoSchema.optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    error: "Tidak ada perubahan yang dikirim.",
  });
export type TrainingUpdateInput = z.infer<typeof trainingUpdateSchema>;

// Status publik turunan: SCHEDULED = PUBLISHED dengan publishedAt di masa depan.
export const TRAINING_STATUS_FILTERS = ["DRAFT", "PUBLISHED", "SCHEDULED"] as const;

export const TRAINING_SORT_FIELDS = ["title", "updatedAt", "createdAt", "publishedAt"] as const;

export const trainingListQuerySchema = listQuerySchema({
  sortFields: TRAINING_SORT_FIELDS,
  defaultSort: "-updatedAt",
  extra: {
    status: z.enum(TRAINING_STATUS_FILTERS).optional(),
    categoryId: idSchema.optional(),
    method: methodSchema.optional(),
    type: typeSchema.optional(),
  },
});
export type TrainingListQuery = z.infer<typeof trainingListQuerySchema>;

export const trainingBulkSchema = z.discriminatedUnion(
  "action",
  [
    z.object({ action: z.literal("publish"), ids: idsSchema }),
    z.object({ action: z.literal("unpublish"), ids: idsSchema }),
    z.object({ action: z.literal("delete"), ids: idsSchema }),
    // Mengganti SEMUA kategori pelatihan terpilih dengan satu kategori ini.
    z.object({ action: z.literal("set-category"), ids: idsSchema, categoryId: idSchema }),
  ],
  { error: "Aksi massal tidak dikenal." },
);
export type TrainingBulkInput = z.infer<typeof trainingBulkSchema>;

// ===== Publik =====

export const PUBLIC_PAGE_SIZE = 24;
export const PUBLIC_SORTS = ["relevan", "terbaru", "az"] as const;

const methodParam = z
  .string()
  .optional()
  .transform((value) => value?.toUpperCase())
  .pipe(methodSchema.optional());

const typeParam = z
  .string()
  .optional()
  .transform((value) => (value === "in-house" ? "IN_HOUSE" : value?.toUpperCase()))
  .pipe(typeSchema.optional());

// Query katalog publik, nama parameter sama dengan URL halaman (?q=&kategori=&metode=&tipe=&urut=&hal=).
// Nilai yang tidak dikenal diabaikan (bukan error), karena URL bisa diketik/dibagikan sembarang.
export const publicTrainingQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .max(100)
    .optional()
    .catch(undefined)
    .transform((value) => value || undefined),
  kategori: csvParam(20).pipe(z.array(z.string())).catch([]),
  metode: methodParam.catch(undefined),
  tipe: typeParam.catch(undefined),
  urut: z.enum(PUBLIC_SORTS).optional().catch(undefined),
  hal: z.coerce.number().int().min(1).max(1000).default(1).catch(1),
  per: z.coerce.number().int().min(1).max(48).default(PUBLIC_PAGE_SIZE).catch(PUBLIC_PAGE_SIZE),
});
export type PublicTrainingQuery = z.infer<typeof publicTrainingQuerySchema>;

export const publicSlugSchema = slugSchema;
