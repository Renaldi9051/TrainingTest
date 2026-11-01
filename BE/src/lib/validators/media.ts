import { z } from "zod";
import { isHttpUrl, requiredText } from "@/lib/validators/common";

// Nama folder bebas tapi sederhana; string kosong = tanpa folder (null).
const folderSchema = z
  .string()
  .trim()
  .max(60, { error: "Nama folder maksimal 60 karakter." })
  .regex(/^[\p{L}\p{N} _-]*$/u, {
    error: "Nama folder hanya boleh berisi huruf, angka, spasi, - dan _.",
  })
  .transform((value) => (value === "" ? null : value));

export const mediaListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(24),
  q: z.string().trim().max(100).optional().transform((value) => value || undefined),
  folder: z.string().trim().max(60).optional().transform((value) => value || undefined),
  sort: z.enum(["newest", "oldest"]).default("newest"),
  // Dipakai MediaPicker: hanya gambar (cover, logo) atau hanya PDF.
  type: z.enum(["image", "pdf"]).optional(),
});

export type MediaListQuery = z.infer<typeof mediaListQuerySchema>;

export const mediaUpdateSchema = z
  .object({
    alt: z
      .string()
      .trim()
      .max(300, { error: "Alt text maksimal 300 karakter." })
      .transform((value) => (value === "" ? null : value))
      .nullable()
      .optional(),
    folder: folderSchema.nullable().optional(),
  })
  .refine((value) => value.alt !== undefined || value.folder !== undefined, {
    error: "Tidak ada perubahan yang dikirim.",
  });

export type MediaUpdateInput = z.infer<typeof mediaUpdateSchema>;

export const mediaUploadFieldsSchema = z.object({
  folder: folderSchema.nullable().optional(),
});

export const mediaIdSchema = z.uuid({ error: "ID media tidak valid." });

// Impor gambar dari URL luar: BE mengunduh lalu menyimpannya seperti upload biasa (lib/remote-image.ts).
export const mediaImportUrlSchema = z.object({
  url: z
    .string({ error: "URL gambar wajib diisi." })
    .trim()
    .min(1, { error: "URL gambar wajib diisi." })
    .max(2000, { error: "URL maksimal 2000 karakter." })
    .refine(isHttpUrl, { error: "URL harus diawali http:// atau https://." }),
  // Alt wajib: gambar hasil impor biasanya langsung dipakai sebagai sampul publik.
  alt: requiredText("Alt text", 300),
  folder: folderSchema.nullable().default(null),
});
export type MediaImportUrlInput = z.infer<typeof mediaImportUrlSchema>;
