import { z } from "zod";
import { HttpError } from "@/lib/http";

export const SLUG_MAX_LENGTH = 120;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// "Analisis Laporan Keuangan (Non-Finance)" -> "analisis-laporan-keuangan-non-finance".
// Diakritik dibuang (é -> e), karakter lain jadi tanda hubung.
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " dan ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX_LENGTH)
    .replace(/-+$/g, "");
}

export const slugSchema = z
  .string()
  .trim()
  .min(1, { error: "Slug wajib diisi." })
  .max(SLUG_MAX_LENGTH, { error: `Slug maksimal ${SLUG_MAX_LENGTH} karakter.` })
  .regex(SLUG_PATTERN, {
    error: "Slug hanya boleh huruf kecil, angka, dan tanda hubung (tanpa spasi).",
  });

// Slug opsional di input: kosong = dibuat dari judul.
export const optionalSlugSchema = z
  .string()
  .trim()
  .optional()
  .transform((value) => value || undefined)
  .pipe(slugSchema.optional());

export const SLUG_TAKEN_MESSAGE = "Slug sudah dipakai. Ganti dengan slug lain.";

export function slugTakenError(): HttpError {
  return new HttpError(409, "SLUG_TAKEN", SLUG_TAKEN_MESSAGE, { slug: [SLUG_TAKEN_MESSAGE] });
}

// Pencarian baris aktif berdasarkan slug. Slug hanya unik di antara baris yang belum dihapus,
// jadi setiap pencarian slug WAJIB lewat sini supaya filter deletedAt tidak terlupa.
export type SlugLookup = (args: {
  where: { slug: string; deletedAt: null; id?: { not: string } };
  select: { id: true };
}) => Promise<{ id: string } | null>;

export async function isSlugTaken(
  findFirst: SlugLookup,
  slug: string,
  excludeId?: string,
): Promise<boolean> {
  const row = await findFirst({
    where: { slug, deletedAt: null, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { id: true },
  });
  return row !== null;
}

export async function assertSlugAvailable(
  findFirst: SlugLookup,
  slug: string,
  excludeId?: string,
): Promise<void> {
  if (await isSlugTaken(findFirst, slug, excludeId)) throw slugTakenError();
}

// Slug unik berikutnya: base, base-2, base-3, ... (dipakai duplikasi & slug otomatis).
export async function nextAvailableSlug(findFirst: SlugLookup, base: string): Promise<string> {
  const root = base.slice(0, SLUG_MAX_LENGTH - 4);
  for (let n = 1; n < 1000; n += 1) {
    const candidate = n === 1 ? root : `${root}-${n}`;
    if (!(await isSlugTaken(findFirst, candidate))) return candidate;
  }
  throw new HttpError(409, "SLUG_TAKEN", SLUG_TAKEN_MESSAGE, { slug: [SLUG_TAKEN_MESSAGE] });
}

// P2002 dari unique index parsial (balapan antara cek dan insert) -> 409 slug.
export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === "P2002"
  );
}

export async function withSlugConflict<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (isUniqueViolation(error)) throw slugTakenError();
    throw error;
  }
}
