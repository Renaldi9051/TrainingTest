import { z } from "zod";
import { listQuerySchema } from "@/lib/list-query";
import {
  hasAnyField,
  NO_CHANGES_ERROR,
  nullableHttpUrlSchema,
  requiredText,
} from "@/lib/validators/common";

// Media partner: nama + link (PRD 7.5), tampil di footer.
const mediaPartnerFields = {
  name: requiredText("Nama", 120),
  url: nullableHttpUrlSchema,
};

export const mediaPartnerCreateSchema = z.object({
  ...mediaPartnerFields,
  url: mediaPartnerFields.url.default(null),
});
export type MediaPartnerCreateInput = z.infer<typeof mediaPartnerCreateSchema>;

export const mediaPartnerUpdateSchema = z
  .object({
    name: mediaPartnerFields.name.optional(),
    url: mediaPartnerFields.url.optional(),
  })
  .refine(hasAnyField, { error: NO_CHANGES_ERROR });
export type MediaPartnerUpdateInput = z.infer<typeof mediaPartnerUpdateSchema>;

export const MEDIA_PARTNER_SORT_FIELDS = ["order", "name", "updatedAt", "createdAt"] as const;

export const mediaPartnerListQuerySchema = listQuerySchema({
  sortFields: MEDIA_PARTNER_SORT_FIELDS,
  defaultSort: "order",
  extra: {},
});
export type MediaPartnerListQuery = z.infer<typeof mediaPartnerListQuerySchema>;
