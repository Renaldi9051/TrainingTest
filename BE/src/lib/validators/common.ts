import { z } from "zod";
import { optionalSlugSchema } from "@/lib/slug";

export const idSchema = z.uuid({ error: "ID tidak valid." });

export const idsSchema = z
  .array(idSchema)
  .min(1, { error: "Pilih minimal satu item." })
  .max(500, { error: "Maksimal 500 item sekaligus." })
  .refine((ids) => new Set(ids).size === ids.length, { error: "ID tidak boleh dobel." });

export const reorderSchema = z.object({ ids: idsSchema });
export type ReorderInput = z.infer<typeof reorderSchema>;

// Teks wajib (di-trim, minimal 1 karakter).
export const requiredText = (label: string, max: number) =>
  z
    .string({ error: `${label} wajib diisi.` })
    .trim()
    .min(1, { error: `${label} wajib diisi.` })
    .max(max, { error: `${label} maksimal ${max} karakter.` });

// Teks opsional: kosong disimpan null.
export const nullableText = (label: string, max: number) =>
  z
    .string()
    .trim()
    .max(max, { error: `${label} maksimal ${max} karakter.` })
    .nullable()
    .optional()
    .transform((value) => (value === undefined ? undefined : value || null));

// Teks di JSON pengaturan: kosong tetap string kosong (bukan null).
export const plainText = (label: string, max: number) =>
  z
    .string()
    .trim()
    .max(max, { error: `${label} maksimal ${max} karakter.` })
    .default("");

export const mediaRefSchema = z.uuid({ error: "Media tidak valid." }).nullable().default(null);

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:") && url.hostname !== "";
  } catch {
    return false;
  }
}

export const HREF_ERROR =
  "Tautan harus berupa path internal yang diawali / (mis. /pelatihan) atau URL http/https.";

// Href menu/tombol: path internal "/..." atau URL http(s) absolut.
export function isValidHref(value: string): boolean {
  if (value.startsWith("/")) {
    return !value.startsWith("//") && !/[\s\\]/.test(value);
  }
  return isHttpUrl(value);
}

export const hrefSchema = z
  .string()
  .trim()
  .min(1, { error: "Tautan wajib diisi." })
  .max(500, { error: "Tautan maksimal 500 karakter." })
  .refine(isValidHref, { error: HREF_ERROR });

export const httpUrlSchema = z
  .string()
  .trim()
  .max(500, { error: "URL maksimal 500 karakter." })
  .refine(isHttpUrl, { error: "URL harus diawali http:// atau https://." });

export const seoSchema = z.object({
  title: z.string().trim().max(70, { error: "Judul SEO maksimal 70 karakter." }).default(""),
  description: z
    .string()
    .trim()
    .max(160, { error: "Deskripsi SEO maksimal 160 karakter." })
    .default(""),
  ogImageId: mediaRefSchema,
});
export type SeoInput = z.infer<typeof seoSchema>;

// Pulihkan dari Sampah; slug baru opsional kalau slug lama sudah dipakai item lain.
export const restoreSchema = z.object({ slug: optionalSlugSchema }).default({ slug: undefined });
export type RestoreInput = z.infer<typeof restoreSchema>;
