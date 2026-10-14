import { z } from "zod";

// GET /api/admin/search?q= (search global admin, Ctrl/Cmd+K).
export const ADMIN_SEARCH_MIN = 2;
export const ADMIN_SEARCH_MAX = 100;

export const adminSearchQuerySchema = z.object({
  q: z
    .string({ error: "Kata kunci wajib diisi." })
    .trim()
    .min(ADMIN_SEARCH_MIN, { error: `Kata kunci minimal ${ADMIN_SEARCH_MIN} karakter.` })
    .max(ADMIN_SEARCH_MAX, { error: `Kata kunci maksimal ${ADMIN_SEARCH_MAX} karakter.` }),
});

export type AdminSearchQuery = z.infer<typeof adminSearchQuerySchema>;

// GET /api/public/search?q= (palette publik): aturan panjang sama dengan search admin.
export const publicSearchQuerySchema = adminSearchQuerySchema;
