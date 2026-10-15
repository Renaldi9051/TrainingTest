import { z } from "zod";
import { listQuerySchema } from "@/lib/list-query";
import {
  hasAnyField,
  idSchema,
  NO_CHANGES_ERROR,
  nullableText,
  requiredText,
  whatsappSchema,
} from "@/lib/validators/common";

// Kontak marketing (panel floating contact Fase 4, halaman kontak). Nomor disimpan format wa.me.
const marketingFields = {
  name: requiredText("Nama", 120),
  // Wilayah/segmen yang ditangani (mis. "Instansi pemerintah"). Kosong = tidak tampil.
  area: nullableText("Area", 60),
  photoId: idSchema.nullable(),
  phone: whatsappSchema,
  defaultMessage: nullableText("Pesan default", 300),
  active: z.boolean(),
};

export const marketingCreateSchema = z.object({
  ...marketingFields,
  area: marketingFields.area.default(null),
  photoId: marketingFields.photoId.default(null),
  defaultMessage: marketingFields.defaultMessage.default(null),
  active: marketingFields.active.default(true),
});
export type MarketingCreateInput = z.infer<typeof marketingCreateSchema>;

export const marketingUpdateSchema = z
  .object({
    name: marketingFields.name.optional(),
    area: marketingFields.area,
    photoId: marketingFields.photoId.optional(),
    phone: marketingFields.phone.optional(),
    defaultMessage: marketingFields.defaultMessage,
    active: marketingFields.active.optional(),
  })
  .refine(hasAnyField, { error: NO_CHANGES_ERROR });
export type MarketingUpdateInput = z.infer<typeof marketingUpdateSchema>;

export const MARKETING_SORT_FIELDS = ["order", "name", "updatedAt", "createdAt"] as const;

export const marketingListQuerySchema = listQuerySchema({
  sortFields: MARKETING_SORT_FIELDS,
  defaultSort: "order",
  extra: {
    active: z
      .enum(["true", "false"])
      .optional()
      .transform((value) => (value === undefined ? undefined : value === "true")),
  },
});
export type MarketingListQuery = z.infer<typeof marketingListQuerySchema>;
