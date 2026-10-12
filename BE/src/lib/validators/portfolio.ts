import { z } from "zod";
import { listQuerySchema } from "@/lib/list-query";
import {
  hasAnyField,
  idSchema,
  NO_CHANGES_ERROR,
  nullableText,
  requiredText,
} from "@/lib/validators/common";
import { dateStringSchema } from "@/lib/validators/schedule";

export const PORTFOLIO_IMAGES_MAX = 30;

// Galeri disimpan di tabel PortfolioImage (urutan = urutan imageIds), bukan array JSON.
const imageIdsSchema = z
  .array(idSchema)
  .max(PORTFOLIO_IMAGES_MAX, { error: `Galeri maksimal ${PORTFOLIO_IMAGES_MAX} gambar.` })
  .refine((ids) => new Set(ids).size === ids.length, { error: "Gambar tidak boleh dobel." });

const portfolioFields = {
  title: requiredText("Judul", 200),
  date: dateStringSchema.nullable(),
  client: nullableText("Klien", 120),
  description: nullableText("Deskripsi", 1000),
  imageIds: imageIdsSchema,
};

export const portfolioCreateSchema = z.object({
  ...portfolioFields,
  date: portfolioFields.date.default(null),
  client: portfolioFields.client.default(null),
  description: portfolioFields.description.default(null),
  imageIds: portfolioFields.imageIds.default([]),
});
export type PortfolioCreateInput = z.infer<typeof portfolioCreateSchema>;

export const portfolioUpdateSchema = z
  .object({
    title: portfolioFields.title.optional(),
    date: portfolioFields.date.optional(),
    client: portfolioFields.client,
    description: portfolioFields.description,
    imageIds: portfolioFields.imageIds.optional(),
  })
  .refine(hasAnyField, { error: NO_CHANGES_ERROR });
export type PortfolioUpdateInput = z.infer<typeof portfolioUpdateSchema>;

export const PORTFOLIO_SORT_FIELDS = ["order", "title", "date", "updatedAt", "createdAt"] as const;

export const portfolioListQuerySchema = listQuerySchema({
  sortFields: PORTFOLIO_SORT_FIELDS,
  defaultSort: "order",
  extra: {},
});
export type PortfolioListQuery = z.infer<typeof portfolioListQuerySchema>;
