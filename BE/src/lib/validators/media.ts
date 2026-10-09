import { z } from "zod";

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
