import { z } from "zod";
import { csvParam } from "@/lib/list-query";
import { idSchema } from "@/lib/validators/common";

export const OPTIONS_DEFAULT_LIMIT = 20;
// Sama dengan batas id reorder: panel urutkan memuat semua baris aktif sekaligus.
export const OPTIONS_MAX_LIMIT = 500;

// GET /api/admin/{resource}/options: pilihan ringan untuk picker (mode manual di builder) dan
// panel urutkan. `ids` = item yang sudah terpilih, selalu ikut dikembalikan walau tidak cocok
// dengan pencarian atau di luar limit, supaya label pilihan tetap tampil.
export const optionsQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .max(100)
    .optional()
    .transform((value) => value || undefined),
  limit: z.coerce.number().int().min(1).max(OPTIONS_MAX_LIMIT).default(OPTIONS_DEFAULT_LIMIT),
  ids: csvParam(OPTIONS_MAX_LIMIT).pipe(z.array(idSchema)),
});
export type OptionsQuery = z.infer<typeof optionsQuerySchema>;
