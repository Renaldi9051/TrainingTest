import { z } from "zod";
import { listQuerySchema } from "@/lib/list-query";
import {
  hasAnyField,
  idSchema,
  NO_CHANGES_ERROR,
  nullableHttpUrlSchema,
  requiredText,
} from "@/lib/validators/common";

const clientFields = {
  name: requiredText("Nama", 120),
  logoId: idSchema.nullable(),
  url: nullableHttpUrlSchema,
};

export const clientCreateSchema = z.object({
  ...clientFields,
  logoId: clientFields.logoId.default(null),
  url: clientFields.url.default(null),
});
export type ClientCreateInput = z.infer<typeof clientCreateSchema>;

export const clientUpdateSchema = z
  .object({
    name: clientFields.name.optional(),
    logoId: clientFields.logoId.optional(),
    url: clientFields.url.optional(),
  })
  .refine(hasAnyField, { error: NO_CHANGES_ERROR });
export type ClientUpdateInput = z.infer<typeof clientUpdateSchema>;

export const CLIENT_SORT_FIELDS = ["order", "name", "updatedAt", "createdAt"] as const;

export const clientListQuerySchema = listQuerySchema({
  sortFields: CLIENT_SORT_FIELDS,
  defaultSort: "order",
  extra: {},
});
export type ClientListQuery = z.infer<typeof clientListQuerySchema>;
