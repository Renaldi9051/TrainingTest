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
    .transform((value) => value || null)
    .nullable()
    .optional();

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

// Path internal "/..." (bukan "//host" protocol-relative, tanpa spasi/backslash/karakter kontrol).
export function isInternalPath(value: string): boolean {
  return value.startsWith("/") && !value.startsWith("//") && !/[\s\\\u0000-\u001f\u007f]/.test(value);
}

// Href menu/tombol: path internal "/..." atau URL http(s) absolut.
export function isValidHref(value: string): boolean {
  if (value.startsWith("/")) return isInternalPath(value);
  return isHttpUrl(value);
}

const MAILTO_PATTERN = /^mailto:([^?]+)(\?.*)?$/i;
const TEL_PATTERN = /^tel:\+?[0-9][0-9().-]{2,29}$/i;

function decodeOrEmpty(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return "";
  }
}

// Href di konten CMS (tombol CTA beranda/halaman): path internal "/...", https://, mailto:, tel:.
// Skema lain (javascript:, data:, http:, vbscript:, dst.) selalu ditolak.
export function isContentHref(value: string): boolean {
  if (/[\s\u0000-\u001f\u007f]/.test(value)) return false;
  if (value.startsWith("/")) return isInternalPath(value);
  if (/^https:\/\//i.test(value)) {
    try {
      const url = new URL(value);
      return url.protocol === "https:" && url.hostname !== "";
    } catch {
      return false;
    }
  }
  const mailto = MAILTO_PATTERN.exec(value);
  if (mailto) return z.email().safeParse(decodeOrEmpty(mailto[1] ?? "")).success;
  return TEL_PATTERN.test(value);
}

export const CONTENT_HREF_ERROR =
  "Tautan harus path internal yang diawali / (mis. /pelatihan), https://, mailto:, atau tel:.";

export const contentHrefSchema = z
  .string({ error: "Tautan wajib diisi." })
  .trim()
  .min(1, { error: "Tautan wajib diisi." })
  .max(500, { error: "Tautan maksimal 500 karakter." })
  .refine(isContentHref, { error: CONTENT_HREF_ERROR });

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

// Tombol di konten CMS: label + href yang aman.
export const ctaSchema = z.object({
  label: requiredText("Label tombol", 40),
  href: contentHrefSchema,
});
export type CtaInput = z.infer<typeof ctaSchema>;

// ===== WhatsApp =====

// "+62 812-0000-0000", "0812 0000 0000", "62812..." -> "6281200000000" (format wa.me).
export function normalizeWhatsapp(value: string): string {
  const digits = value.replace(/[^\d]/g, "");
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  return digits;
}

const WHATSAPP_CHARS_ERROR = "Nomor WhatsApp hanya boleh berisi angka, spasi, +, -, dan tanda kurung.";
const WHATSAPP_INVALID_ERROR = "Nomor WhatsApp tidak valid. Contoh: +62 812 3456 7890.";
const isWhatsappChars = (value: string) => /^[+\d][\d\s().-]*$/.test(value);
const isWhatsappLength = (value: string) => value.length >= 9 && value.length <= 15;

// Opsional (pengaturan situs): kosong tetap string kosong.
export const optionalWhatsappSchema = z
  .string()
  .trim()
  .max(30)
  .refine((value) => value === "" || isWhatsappChars(value), { error: WHATSAPP_CHARS_ERROR })
  .transform(normalizeWhatsapp)
  .refine((value) => value === "" || isWhatsappLength(value), { error: WHATSAPP_INVALID_ERROR })
  .default("");

// Wajib (kontak marketing).
export const whatsappSchema = z
  .string({ error: "Nomor WhatsApp wajib diisi." })
  .trim()
  .min(1, { error: "Nomor WhatsApp wajib diisi." })
  .max(30, { error: "Nomor WhatsApp maksimal 30 karakter." })
  .refine(isWhatsappChars, { error: WHATSAPP_CHARS_ERROR })
  .transform(normalizeWhatsapp)
  .refine(isWhatsappLength, { error: WHATSAPP_INVALID_ERROR });

// URL http(s) opsional (link klien, media partner): kosong disimpan null.
export const nullableHttpUrlSchema = z
  .string()
  .trim()
  .transform((value) => value || null)
  .pipe(httpUrlSchema.nullable())
  .nullable();

// Skema update: minimal satu field dikirim.
export function hasAnyField(value: Record<string, unknown>): boolean {
  return Object.values(value).some((field) => field !== undefined);
}
export const NO_CHANGES_ERROR = "Tidak ada perubahan yang dikirim.";
