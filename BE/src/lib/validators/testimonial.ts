import { z } from "zod";
import { listQuerySchema } from "@/lib/list-query";
import {
  hasAnyField,
  idSchema,
  NO_CHANGES_ERROR,
  nullableText,
  requiredText,
} from "@/lib/validators/common";

export const QUOTE_MAX = 600;

const testimonialFields = {
  name: requiredText("Nama", 120),
  // Jabatan pemberi testimoni.
  role: nullableText("Jabatan", 120),
  company: nullableText("Instansi", 120),
  quote: requiredText("Testimoni", QUOTE_MAX),
  photoId: idSchema.nullable(),
};

export const testimonialCreateSchema = z.object({
  ...testimonialFields,
  role: testimonialFields.role.default(null),
  company: testimonialFields.company.default(null),
  photoId: testimonialFields.photoId.default(null),
});
export type TestimonialCreateInput = z.infer<typeof testimonialCreateSchema>;

export const testimonialUpdateSchema = z
  .object({
    name: testimonialFields.name.optional(),
    role: testimonialFields.role,
    company: testimonialFields.company,
    quote: testimonialFields.quote.optional(),
    photoId: testimonialFields.photoId.optional(),
  })
  .refine(hasAnyField, { error: NO_CHANGES_ERROR });
export type TestimonialUpdateInput = z.infer<typeof testimonialUpdateSchema>;

export const TESTIMONIAL_SORT_FIELDS = ["order", "name", "updatedAt", "createdAt"] as const;

export const testimonialListQuerySchema = listQuerySchema({
  sortFields: TESTIMONIAL_SORT_FIELDS,
  defaultSort: "order",
  extra: {},
});
export type TestimonialListQuery = z.infer<typeof testimonialListQuerySchema>;
