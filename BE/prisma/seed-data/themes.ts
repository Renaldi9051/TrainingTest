// Pool foto per tema (gallery/themes.json) untuk kategori & pelatihan di luar manifest accounting.
// Kategori dipetakan ke tema lewat pola slug (tema pertama yang cocok), sisanya ke tema bawaan.
// Pilihan foto deterministik dari slug, jadi seed ulang memberi hasil yang sama.
import { readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";

export const THEMES_DIR = path.join(__dirname, "gallery");

const photoSchema = z.object({
  file: z.string().min(1),
  alt: z.string().min(1).max(200),
  source: z.object({ provider: z.string(), creator: z.string().nullable(), license: z.string(), url: z.string() }),
});
const themesSchema = z
  .object({
    default: z.string().min(1),
    themes: z
      .array(
        z.object({
          key: z.string().min(1),
          label: z.string().min(1),
          // Regex untuk slug kategori; null hanya untuk tema bawaan.
          match: z.string().min(1).nullable(),
          // Sampul + 4 foto galeri harus berbeda.
          photos: z.array(photoSchema).min(5),
        }),
      )
      .min(1),
    // File foto pool versi sebelumnya yang sudah diganti (boleh ditimpa seed).
    retired: z.array(z.string().min(1)).default([]),
  })
  .refine((value) => value.themes.some((theme) => theme.key === value.default), "Tema bawaan tidak ada.");

export type ThemePhoto = z.infer<typeof photoSchema>;
export type Themes = z.infer<typeof themesSchema> & { patterns: Map<string, RegExp> };

export const GALLERY_SIZE = 4;

export function loadThemes(file = path.join(THEMES_DIR, "themes.json")): Themes {
  const parsed = themesSchema.parse(JSON.parse(readFileSync(file, "utf8")));
  const patterns = new Map(
    parsed.themes.flatMap((theme) => (theme.match ? [[theme.key, new RegExp(theme.match)] as const] : [])),
  );
  return { ...parsed, patterns };
}

export function themeFor(themes: Themes, categorySlug: string | null | undefined) {
  const match = categorySlug
    ? themes.themes.find((theme) => themes.patterns.get(theme.key)?.test(categorySlug))
    : undefined;
  return match ?? (themes.themes.find((theme) => theme.key === themes.default) as Themes["themes"][number]);
}

// FNV-1a 32-bit: sebaran cukup rata untuk memilih foto dari slug.
function hash(value: string): number {
  let result = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 0x01000193) >>> 0;
  }
  return result;
}

export function categoryPhoto(themes: Themes, categorySlug: string): ThemePhoto {
  const { photos } = themeFor(themes, categorySlug);
  return photos[hash(categorySlug) % photos.length];
}

// Sampul + galeri pelatihan: foto berurutan (memutar) dari posisi yang ditentukan slug pelatihan.
export function trainingPhotos(
  themes: Themes,
  categorySlug: string | null,
  trainingSlug: string,
): { cover: ThemePhoto; gallery: ThemePhoto[] } {
  const { photos } = themeFor(themes, categorySlug);
  const start = hash(trainingSlug) % photos.length;
  const at = (offset: number) => photos[(start + offset) % photos.length];
  return { cover: at(0), gallery: Array.from({ length: GALLERY_SIZE }, (_, index) => at(index + 1)) };
}

// Nama file asli di media library (sama dengan seed-manifest-gallery.ts).
export const themeUploadName = (file: string) => file.replaceAll("/", "--");
