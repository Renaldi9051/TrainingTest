import { z } from "zod";
import { listQuerySchema } from "@/lib/list-query";
import { slugSchema } from "@/lib/slug";
import { idSchema, nullableText } from "@/lib/validators/common";
import { TRAINING_METHODS } from "@/lib/validators/training";

export const SCHEDULE_STATUSES = ["OPEN", "FULL", "COMPLETED"] as const;

// Tanggal kalender "YYYY-MM-DD" (kolom @db.Date), divalidasi benar-benar ada (bukan 2026-02-31).
export function isValidDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export const dateStringSchema = z
  .string()
  .trim()
  .refine(isValidDateString, { error: "Tanggal harus berformat YYYY-MM-DD, mis. 2026-11-17." });

const MAX_PRICE = 10_000_000_000;

const priceSchema = z
  .number({ error: "Harga harus berupa angka." })
  .int({ error: "Harga tanpa desimal (Rupiah)." })
  .min(0, { error: "Harga tidak boleh negatif." })
  .max(MAX_PRICE, { error: "Harga terlalu besar." })
  .nullable();

const scheduleFields = {
  trainingId: idSchema,
  startDate: dateStringSchema,
  endDate: dateStringSchema,
  city: nullableText("Kota", 100),
  venue: nullableText("Tempat", 200),
  method: z.enum(TRAINING_METHODS, { error: "Metode tidak dikenal." }),
  price: priceSchema,
  status: z.enum(SCHEDULE_STATUSES, { error: "Status tidak dikenal." }),
};

const END_AFTER_START = "Tanggal selesai tidak boleh sebelum tanggal mulai.";

export const scheduleCreateSchema = z
  .object({
    ...scheduleFields,
    city: scheduleFields.city.default(null),
    venue: scheduleFields.venue.default(null),
    price: scheduleFields.price.default(null),
    status: scheduleFields.status.default("OPEN"),
  })
  .refine((value) => value.endDate >= value.startDate, { error: END_AFTER_START, path: ["endDate"] });
export type ScheduleCreateInput = z.infer<typeof scheduleCreateSchema>;

export const scheduleUpdateSchema = z
  .object({
    trainingId: scheduleFields.trainingId.optional(),
    startDate: scheduleFields.startDate.optional(),
    endDate: scheduleFields.endDate.optional(),
    city: scheduleFields.city,
    venue: scheduleFields.venue,
    method: scheduleFields.method.optional(),
    price: scheduleFields.price.optional(),
    status: scheduleFields.status.optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    error: "Tidak ada perubahan yang dikirim.",
  });
export type ScheduleUpdateInput = z.infer<typeof scheduleUpdateSchema>;

export const END_AFTER_START_MESSAGE = END_AFTER_START;

const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, { error: "Bulan harus berformat YYYY-MM." });

export const scheduleListQuerySchema = listQuerySchema({
  sortFields: ["startDate", "updatedAt", "createdAt"] as const,
  defaultSort: "-startDate",
  extra: {
    trainingId: idSchema.optional(),
    status: z.enum(SCHEDULE_STATUSES).optional(),
    month: monthSchema.optional(),
    period: z.enum(["upcoming", "past"]).optional(),
  },
});
export type ScheduleListQuery = z.infer<typeof scheduleListQuerySchema>;

// Query /jadwal publik: ?bulan=2026-11&kota=Jakarta&kategori=keuangan&hal=1.
// Nilai yang tidak dikenal diabaikan (bukan error).
export const publicScheduleQuerySchema = z.object({
  bulan: monthSchema.optional().catch(undefined),
  kota: z
    .string()
    .trim()
    .max(100)
    .optional()
    .catch(undefined)
    .transform((value) => value || undefined),
  kategori: slugSchema.optional().catch(undefined),
  hal: z.coerce.number().int().min(1).max(1000).default(1).catch(1),
  per: z.coerce.number().int().min(1).max(100).default(50).catch(50),
});
export type PublicScheduleQuery = z.infer<typeof publicScheduleQuerySchema>;

export const MAX_IMPORT_ROWS = 1000;
export const MAX_IMPORT_BYTES = 1024 * 1024;

export const scheduleImportSchema = z.object({
  csv: z
    .string({ error: "Isi CSV wajib dikirim." })
    .min(1, { error: "File CSV kosong." })
    .max(MAX_IMPORT_BYTES, { error: "File CSV maksimal 1 MB." }),
  dryRun: z.boolean().default(true),
});
export type ScheduleImportInput = z.infer<typeof scheduleImportSchema>;
