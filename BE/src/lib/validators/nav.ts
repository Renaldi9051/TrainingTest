import { z } from "zod";
import { hrefSchema, idSchema, requiredText } from "@/lib/validators/common";

export const navLocationSchema = z.enum(["HEADER", "FOOTER"], { error: "Lokasi menu tidak dikenal." });

export const navCreateSchema = z.object({
  location: navLocationSchema,
  label: requiredText("Label", 60),
  href: hrefSchema,
  parentId: idSchema.nullable().default(null),
});
export type NavCreateInput = z.infer<typeof navCreateSchema>;

// Lokasi tidak bisa diubah setelah dibuat (pindah lokasi = hapus lalu buat baru).
export const navUpdateSchema = z
  .object({
    label: requiredText("Label", 60).optional(),
    href: hrefSchema.optional(),
    parentId: idSchema.nullable().optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    error: "Tidak ada perubahan yang dikirim.",
  });
export type NavUpdateInput = z.infer<typeof navUpdateSchema>;

export const navListQuerySchema = z.object({ location: navLocationSchema.optional() });
