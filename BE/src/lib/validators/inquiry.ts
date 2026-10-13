import { z } from "zod";
import { listQuerySchema } from "@/lib/list-query";
import { hasAnyField, idSchema, NO_CHANGES_ERROR, nullableText, optionalWhatsappSchema, requiredText } from "@/lib/validators/common";

// Inquiry (PRD 5.6, 5.9, 6.1). Form publik divalidasi di sini; FE hanya cek ringan (atribut HTML).

// Versi teks persetujuan pemrosesan data (UU PDP). Ubah versi setiap kali teks di FE
// (FE/src/components/public/inquiry-form.tsx, CONSENT_TEXT) berubah.
export const CONSENT_VERSION = "2026-10";

export const INQUIRY_STATUSES = ["NEW", "IN_PROGRESS", "DONE"] as const;
export const INQUIRY_SOURCES = ["TRAINING_DETAIL", "CONTACT"] as const;

export const inquiryCreateSchema = z.object({
  name: requiredText("Nama", 100).refine((value) => value.length >= 2, { error: "Nama minimal 2 karakter." }),
  company: nullableText("Instansi", 150).default(null),
  email: z
    .string({ error: "Email wajib diisi." })
    .trim()
    .min(1, { error: "Email wajib diisi." })
    .max(254, { error: "Email maksimal 254 karakter." })
    .pipe(z.email({ error: "Format email tidak valid." }))
    .transform((value) => value.toLowerCase()),
  // Opsional; dinormalisasi ke format wa.me (62xxxxxxxxxx). Kosong disimpan null.
  phone: optionalWhatsappSchema.transform((value) => value || null),
  trainingId: idSchema.nullable().default(null),
  interest: nullableText("Pelatihan yang diminati", 200).default(null),
  message: nullableText("Pesan", 2000).default(null),
  source: z.enum(INQUIRY_SOURCES, { error: "Sumber tidak dikenal." }).default("CONTACT"),
  consent: z.literal(true, { error: "Centang persetujuan pemrosesan data untuk mengirim." }),
  // Honeypot: tersembunyi dari manusia (CSS + aria-hidden). Terisi = bot.
  website: z.string().max(500).optional().default(""),
});
export type InquiryCreateInput = z.infer<typeof inquiryCreateSchema>;

export const inquiryUpdateSchema = z
  .object({
    status: z.enum(INQUIRY_STATUSES, { error: "Status tidak dikenal." }).optional(),
    note: nullableText("Catatan", 2000),
  })
  .refine(hasAnyField, { error: NO_CHANGES_ERROR });
export type InquiryUpdateInput = z.infer<typeof inquiryUpdateSchema>;

const dateParam = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Tanggal harus berformat YYYY-MM-DD." })
  .optional();

const inquiryFilters = {
  status: z.enum(INQUIRY_STATUSES).optional(),
  // Rentang tanggal masuk (WIB), inklusif.
  from: dateParam,
  to: dateParam,
};

export const inquiryListQuerySchema = listQuerySchema({
  sortFields: ["createdAt", "updatedAt", "name"] as const,
  defaultSort: "-createdAt",
  extra: inquiryFilters,
});
export type InquiryListQuery = z.infer<typeof inquiryListQuerySchema>;

export const inquiryExportQuerySchema = z.object({ ...inquiryFilters, q: z.string().trim().max(100).optional() });
export type InquiryExportQuery = z.infer<typeof inquiryExportQuerySchema>;
