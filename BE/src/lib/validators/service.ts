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
  requiredText,
  seoSchema,
} from "@/lib/validators/common";

// Layanan (/layanan/[slug]). Ikon memakai daftar ikon kategori.
const serviceFields = {
  title: requiredText("Judul", 200),
  slug: optionalSlugSchema,
  icon: iconSchema,
  summary: nullableText("Ringkasan", 300),
  body: optionalRichTextSchema,
  imageId: idSchema.nullable(),
  status: z.enum(["DRAFT", "PUBLISHED"], { error: "Status tidak dikenal." }),
  seo: seoSchema,
};

export const serviceCreateSchema = z.object({
  ...serviceFields,
  icon: serviceFields.icon.default(null),
  summary: serviceFields.summary.default(null),
  body: serviceFields.body.default(null),
  imageId: serviceFields.imageId.default(null),
  status: serviceFields.status.default("DRAFT"),
  seo: seoSchema.default({ title: "", description: "", ogImageId: null }),
});
export type ServiceCreateInput = z.infer<typeof serviceCreateSchema>;

export const serviceUpdateSchema = z
  .object({
    title: serviceFields.title.optional(),
    slug: serviceFields.slug,
    icon: serviceFields.icon.optional(),
    summary: serviceFields.summary,
    body: serviceFields.body,
    imageId: serviceFields.imageId.optional(),
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
