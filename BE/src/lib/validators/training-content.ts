import { z } from "zod";
import { optionalRichTextSchema, richTextToPlain } from "@/lib/rich-text";
import { nullableText, requiredText } from "@/lib/validators/common";

// Konten detail pelatihan yang terstruktur (bukan rich text bebas). Batas di sini juga dipakai
// FE admin untuk penghitung karakter (FE/src/lib/training-content.ts); ubah keduanya bersamaan.

export const SUMMARY_MAX = 200;
export const DESCRIPTION_MAX_CHARS = 1500;
export const OUTCOMES_MIN = 4;
export const OUTCOMES_MAX = 8;
export const OUTCOME_MAX = 160;
export const MODULES_MAX = 20;
export const MODULE_TITLE_MAX = 120;
export const MODULE_POINTS_MAX = 12;
export const MODULE_POINT_MAX = 200;
export const AUDIENCE_MAX = 12;
export const AUDIENCE_ROLE_MAX = 100;
export const AUDIENCE_NOTE_MAX = 160;
export const PREREQUISITES_MAX = 300;
export const FACILITIES_MAX = 20;
export const FACILITY_MAX = 120;
export const FAQ_MAX = 20;
export const FAQ_Q_MAX = 200;
export const FAQ_A_MAX = 1000;

export const summarySchema = nullableText("Ringkasan", SUMMARY_MAX);

// Rich text deskripsi; "maks 2 paragraf" hanya hint di admin, panjang total tetap dibatasi.
export const descriptionSchema = optionalRichTextSchema.refine(
  (doc) => !doc || richTextToPlain(doc).length <= DESCRIPTION_MAX_CHARS,
  { error: `Deskripsi maksimal ${DESCRIPTION_MAX_CHARS} karakter (sekitar 2 paragraf).` },
);

// Batas jumlah minimal (4) tidak dicek di sini: draf boleh belum lengkap.
// Dicek saat status Tayang lewat publishIssues().
export const outcomesSchema = z
  .array(requiredText("Hasil belajar", OUTCOME_MAX))
  .max(OUTCOMES_MAX, { error: `Hasil belajar maksimal ${OUTCOMES_MAX} item.` });

const durationSchema = z
  .number({ error: "Durasi harus angka (menit)." })
  .int({ error: "Durasi dalam menit bulat." })
  .min(1, { error: "Durasi minimal 1 menit." })
  .max(600, { error: "Durasi maksimal 600 menit per modul." })
  .nullable()
  .optional()
  .transform((value) => value ?? null);

export const moduleSchema = z.object({
  title: requiredText("Judul modul", MODULE_TITLE_MAX),
  points: z
    .array(requiredText("Poin materi", MODULE_POINT_MAX))
    .max(MODULE_POINTS_MAX, { error: `Maksimal ${MODULE_POINTS_MAX} poin per modul.` }),
  durationMinutes: durationSchema,
});
export type TrainingModule = z.infer<typeof moduleSchema>;

export const modulesSchema = z
  .array(moduleSchema)
  .max(MODULES_MAX, { error: `Materi maksimal ${MODULES_MAX} modul.` });

const optionalNote = z
  .string()
  .trim()
  .max(AUDIENCE_NOTE_MAX, { error: `Catatan maksimal ${AUDIENCE_NOTE_MAX} karakter.` })
  .nullable()
  .optional()
  .transform((value) => value || null);

export const audienceItemSchema = z.object({
  role: requiredText("Peran", AUDIENCE_ROLE_MAX),
  note: optionalNote,
});
export type AudienceItem = z.infer<typeof audienceItemSchema>;

export const audienceSchema = z
  .array(audienceItemSchema)
  .max(AUDIENCE_MAX, { error: `Target peserta maksimal ${AUDIENCE_MAX} item.` });

export const prerequisitesSchema = nullableText("Prasyarat", PREREQUISITES_MAX);

export const facilitiesListSchema = z
  .array(requiredText("Fasilitas", FACILITY_MAX))
  .max(FACILITIES_MAX, { error: `Fasilitas maksimal ${FACILITIES_MAX} item.` });

// null = pakai fasilitas default global (SiteSetting training.defaults).
export const facilitiesSchema = facilitiesListSchema.nullable();

export const faqItemSchema = z.object({
  q: requiredText("Pertanyaan", FAQ_Q_MAX),
  a: requiredText("Jawaban", FAQ_A_MAX),
});
export type FaqItem = z.infer<typeof faqItemSchema>;

export const faqSchema = z.array(faqItemSchema).max(FAQ_MAX, { error: `FAQ maksimal ${FAQ_MAX} item.` });

// Syarat konten sebelum boleh tayang (status Tayang / bulk publish / publish terjadwal).
export type PublishIssue = { field: "outcomes"; message: string };

export function publishIssues(content: { outcomes: readonly string[] }): PublishIssue[] {
  const count = content.outcomes.length;
  if (count < OUTCOMES_MIN || count > OUTCOMES_MAX) {
    return [
      {
        field: "outcomes",
        message: `Isi ${OUTCOMES_MIN}-${OUTCOMES_MAX} hasil belajar sebelum menayangkan (sekarang ${count}).`,
      },
    ];
  }
  return [];
}

// Membaca kolom JSON dari DB dengan aman: data rusak/lama jadi nilai kosong, bukan error.
export function readModules(value: unknown): TrainingModule[] {
  const parsed = modulesSchema.safeParse(value);
  return parsed.success ? parsed.data : [];
}

export function readAudience(value: unknown): AudienceItem[] {
  const parsed = audienceSchema.safeParse(value);
  return parsed.success ? parsed.data : [];
}

export function readFaq(value: unknown): FaqItem[] {
  const parsed = faqSchema.safeParse(value);
  return parsed.success ? parsed.data : [];
}

export function readFacilities(value: unknown): string[] | null {
  if (value === null || value === undefined) return null;
  const parsed = facilitiesListSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
