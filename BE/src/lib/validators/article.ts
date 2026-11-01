import { z } from "zod";
import { listQuerySchema } from "@/lib/list-query";
import { optionalRichTextSchema } from "@/lib/rich-text";
import { optionalSlugSchema, slugSchema } from "@/lib/slug";
import {
  hasAnyField,
  idSchema,
  idsSchema,
  NO_CHANGES_ERROR,
  nullableHttpUrlSchema,
  nullableText,
  requiredText,
  seoSchema,
} from "@/lib/validators/common";

export const ARTICLE_TITLE_MAX = 200;
export const ARTICLE_EXCERPT_MAX = 400;

// publishedAt: ISO datetime dari form (datetime-local dikonversi FE ke ISO dengan zona WIB).
const publishedAtSchema = z.iso
  .datetime({ offset: true, error: "Waktu publish tidak valid." })
  .transform((value) => new Date(value))
  .nullable();

const articleFields = {
  title: requiredText("Judul", ARTICLE_TITLE_MAX),
  slug: optionalSlugSchema,
  excerpt: nullableText("Ringkasan", ARTICLE_EXCERPT_MAX),
  // Draf boleh kosong; isi wajib saat Tayang (dicek di service). Kosong disimpan sebagai dokumen kosong.
  body: optionalRichTextSchema,
  authorName: requiredText("Penulis", 120),
  sourceName: nullableText("Nama sumber", 160),
  sourceUrl: nullableHttpUrlSchema.optional(),
  categoryId: z.uuid({ error: "Pilih kategori." }),
  coverId: idSchema.nullable(),
  status: z.enum(["DRAFT", "PUBLISHED"], { error: "Status tidak dikenal." }),
  publishedAt: publishedAtSchema,
  seo: seoSchema,
};

export const articleCreateSchema = z.object({
  ...articleFields,
  excerpt: articleFields.excerpt.default(null),
  body: articleFields.body.default(null),
  sourceName: articleFields.sourceName.default(null),
  sourceUrl: articleFields.sourceUrl.default(null),
  coverId: articleFields.coverId.default(null),
  status: articleFields.status.default("DRAFT"),
  publishedAt: articleFields.publishedAt.default(null),
  seo: seoSchema.default({ title: "", description: "", ogImageId: null }),
});
export type ArticleCreateInput = z.infer<typeof articleCreateSchema>;

export const articleUpdateSchema = z
  .object({
    title: articleFields.title.optional(),
    slug: articleFields.slug,
    excerpt: articleFields.excerpt,
    body: articleFields.body,
    authorName: articleFields.authorName.optional(),
    sourceName: articleFields.sourceName,
    sourceUrl: articleFields.sourceUrl,
    categoryId: articleFields.categoryId.optional(),
    coverId: articleFields.coverId.optional(),
    status: articleFields.status.optional(),
    publishedAt: articleFields.publishedAt.optional(),
    seo: seoSchema.optional(),
  })
  .refine(hasAnyField, { error: NO_CHANGES_ERROR });
export type ArticleUpdateInput = z.infer<typeof articleUpdateSchema>;

// Status tampilan: SCHEDULED = PUBLISHED dengan publishedAt di masa depan (sama dengan pelatihan).
export const ARTICLE_STATUS_FILTERS = ["DRAFT", "PUBLISHED", "SCHEDULED"] as const;
export const ARTICLE_SORT_FIELDS = ["title", "updatedAt", "createdAt", "publishedAt"] as const;

export const articleListQuerySchema = listQuerySchema({
  sortFields: ARTICLE_SORT_FIELDS,
  defaultSort: "-updatedAt",
  extra: {
    status: z.enum(ARTICLE_STATUS_FILTERS).optional(),
    categoryId: idSchema.optional(),
  },
});
export type ArticleListQuery = z.infer<typeof articleListQuerySchema>;

// Kalender admin: satu bulan WIB, "2026-11".
export const articleCalendarQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, { error: "Bulan harus berformat YYYY-MM." }),
});
export type ArticleCalendarQuery = z.infer<typeof articleCalendarQuerySchema>;

export const articleBulkSchema = z.discriminatedUnion(
  "action",
  [
    z.object({ action: z.literal("publish"), ids: idsSchema }),
    z.object({ action: z.literal("unpublish"), ids: idsSchema }),
    z.object({ action: z.literal("delete"), ids: idsSchema }),
  ],
  { error: "Aksi massal tidak dikenal." },
);
export type ArticleBulkInput = z.infer<typeof articleBulkSchema>;

// ===== Kategori artikel =====

export const articleCategoryCreateSchema = z.object({
  name: requiredText("Nama kategori", 80),
  slug: optionalSlugSchema,
});
export type ArticleCategoryCreateInput = z.infer<typeof articleCategoryCreateSchema>;

export const articleCategoryUpdateSchema = z
  .object({ name: requiredText("Nama kategori", 80).optional(), slug: optionalSlugSchema })
  .refine(hasAnyField, { error: NO_CHANGES_ERROR });
export type ArticleCategoryUpdateInput = z.infer<typeof articleCategoryUpdateSchema>;

// ===== Publik =====

export const PUBLIC_ARTICLE_PAGE_SIZE = 12;

// ?kategori=<slug>&hal=2. Nilai yang tidak dikenal diabaikan, karena URL bisa diketik sembarang.
export const publicArticleQuerySchema = z.object({
  kategori: slugSchema.optional().catch(undefined),
  hal: z.coerce.number().int().min(1).max(1000).default(1).catch(1),
  per: z.coerce
    .number()
    .int()
    .min(1)
    .max(48)
    .default(PUBLIC_ARTICLE_PAGE_SIZE)
    .catch(PUBLIC_ARTICLE_PAGE_SIZE),
});
export type PublicArticleQuery = z.infer<typeof publicArticleQuerySchema>;
