import { z } from "zod";
import { listQuerySchema } from "@/lib/list-query";
import { optionalSlugSchema } from "@/lib/slug";
import { idSchema, idsSchema, nullableText, requiredText } from "@/lib/validators/common";

// Nama ikon lucide (kebab-case) yang boleh dipakai kategori. FE memetakan nama yang sama ke
// komponen ikon di FE/src/lib/category-icons.ts; ubah keduanya bersamaan.
export const CATEGORY_ICONS = [
  "award",
  "banknote",
  "book-open",
  "brain",
  "briefcase-business",
  "building-2",
  "calculator",
  "camera",
  "chart-column",
  "chart-pie",
  "clipboard-check",
  "code",
  "cog",
  "coins",
  "cpu",
  "database",
  "factory",
  "file-text",
  "fuel",
  "globe",
  "graduation-cap",
  "handshake",
  "hard-hat",
  "heart-pulse",
  "landmark",
  "laptop",
  "leaf",
  "lightbulb",
  "megaphone",
  "messages-square",
  "palette",
  "plane",
  "presentation",
  "scale",
  "settings",
  "shield-check",
  "ship",
  "shopping-cart",
  "stethoscope",
  "target",
  "truck",
  "user-cog",
  "users",
  "utensils",
  "video",
  "warehouse",
  "wrench",
  "zap",
] as const;

export type CategoryIcon = (typeof CATEGORY_ICONS)[number];

export const iconSchema = z
  .enum(CATEGORY_ICONS, { error: "Ikon tidak dikenal. Pilih dari daftar ikon." })
  .nullable();

export const CATEGORY_KEYWORDS_MAX = 20;
export const CATEGORY_KEYWORD_MAX_LENGTH = 60;

// Kata kunci judul pelatihan (fitur "Pelatihan yang cocok"). Spasi dirapikan; duplikat yang hanya
// beda huruf besar/kecil dibuang (yang pertama dipertahankan).
export const keywordsSchema = z
  .array(
    z
      .string()
      .transform((value) => value.replace(/\s+/g, " ").trim())
      .pipe(
        z
          .string()
          .min(2, { error: "Kata kunci minimal 2 karakter." })
          .max(CATEGORY_KEYWORD_MAX_LENGTH, { error: `Kata kunci maksimal ${CATEGORY_KEYWORD_MAX_LENGTH} karakter.` })
          .regex(/[\p{L}\p{N}]/u, { error: "Kata kunci harus berisi huruf atau angka." }),
      ),
  )
  .max(CATEGORY_KEYWORDS_MAX, { error: `Maksimal ${CATEGORY_KEYWORDS_MAX} kata kunci.` })
  .transform((values) => {
    const seen = new Set<string>();
    return values.filter((value) => {
      const key = value.toLocaleLowerCase("id-ID");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  });

// ===== Halaman kategori v2 (landing): summary, cover alt, target peserta, galeri =====

export const CATEGORY_SUMMARY_MAX = 160;
export const CATEGORY_COVER_ALT_MAX = 300;
export const CATEGORY_AUDIENCE_MAX = 12;
export const CATEGORY_AUDIENCE_LABEL_MAX = 120;
export const CATEGORY_GALLERY_MAX = 4;

export const CATEGORY_AUDIENCE_SOURCES = ["manual", "auto"] as const;
export type CategoryAudienceSource = (typeof CATEGORY_AUDIENCE_SOURCES)[number];

// Ringkasan 1 kalimat; kosong disimpan null. Dipakai meta description landing kategori.
export const summarySchema = nullableText("Ringkasan", CATEGORY_SUMMARY_MAX);

// Alt kontekstual cover; kosong disimpan null (publik jatuh ke alt Media).
export const coverAltSchema = nullableText("Alt gambar cover", CATEGORY_COVER_ALT_MAX);

export const audienceSourceSchema = z.enum(CATEGORY_AUDIENCE_SOURCES, {
  error: "Sumber target peserta tidak dikenal.",
});

// Satu baris target peserta kategori: label peran + jumlah pelatihan opsional.
export const categoryAudienceItemSchema = z.object({
  label: requiredText("Peran", CATEGORY_AUDIENCE_LABEL_MAX),
  trainingCount: z
    .number({ error: "Jumlah pelatihan harus angka." })
    .int({ error: "Jumlah pelatihan harus bilangan bulat." })
    .min(0, { error: "Jumlah pelatihan tidak boleh negatif." })
    .nullable()
    .optional()
    .transform((value) => value ?? null),
});
export type CategoryAudienceItem = z.infer<typeof categoryAudienceItemSchema>;

export const audienceSchema = z
  .array(categoryAudienceItemSchema)
  .max(CATEGORY_AUDIENCE_MAX, { error: `Target peserta maksimal ${CATEGORY_AUDIENCE_MAX} item.` });

// Galeri foto kategori: urut, maks 4, tanpa dobel. Alt wajib dicek di service (requireAlt), pola
// sama dengan galeri pelatihan/portofolio.
export const galleryImageIdsSchema = z
  .array(idSchema)
  .max(CATEGORY_GALLERY_MAX, { error: `Galeri maksimal ${CATEGORY_GALLERY_MAX} gambar.` })
  .refine((ids) => new Set(ids).size === ids.length, { error: "Gambar tidak boleh dobel." });

export const categoryCreateSchema = z.object({
  name: requiredText("Nama", 100),
  slug: optionalSlugSchema,
  description: nullableText("Deskripsi", 1000).default(null),
  // Ringkasan 1 kalimat; juga dipakai sebagai meta description landing kategori.
  summary: summarySchema.default(null),
  icon: iconSchema.default(null),
  featured: z.boolean().default(false),
  // Gambar kategori (media library, alt wajib): cover landing + fallback sampul pelatihan tanpa cover.
  imageId: idSchema.nullable().default(null),
  // Alt kontekstual cover di landing; kosong = pakai alt Media.
  coverAlt: coverAltSchema.default(null),
  // Target peserta kategori (ringkasan). Admin bisa mengisi manual atau mengambil dari pelatihan.
  audience: audienceSchema.default([]),
  audienceSource: audienceSourceSchema.default("manual"),
  // Galeri foto kategori (maks 4). Media library, alt wajib (dicek service via requireAlt).
  imageIds: galleryImageIdsSchema.default([]),
  keywords: keywordsSchema.default([]),
});
export type CategoryCreateInput = z.infer<typeof categoryCreateSchema>;

export const categoryUpdateSchema = z
  .object({
    name: requiredText("Nama", 100).optional(),
    slug: optionalSlugSchema,
    description: nullableText("Deskripsi", 1000),
    summary: summarySchema,
    icon: iconSchema.optional(),
    featured: z.boolean().optional(),
    imageId: idSchema.nullable().optional(),
    coverAlt: coverAltSchema,
    audience: audienceSchema.optional(),
    audienceSource: audienceSourceSchema.optional(),
    imageIds: galleryImageIdsSchema.optional(),
    keywords: keywordsSchema.optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    error: "Tidak ada perubahan yang dikirim.",
  });
export type CategoryUpdateInput = z.infer<typeof categoryUpdateSchema>;

// Tautkan pelatihan terpilih dari daftar "Pelatihan yang cocok" (tautan hanya ditambah).
export const keywordLinkSchema = z.object({ trainingIds: idsSchema });
export type KeywordLinkInput = z.infer<typeof keywordLinkSchema>;

// Gabungkan kategori ini ke kategori tujuan.
export const categoryMergeSchema = z.object({ targetId: idSchema });
export type CategoryMergeInput = z.infer<typeof categoryMergeSchema>;

// DELETE ?detach=true: lepas kategori dari semua pelatihan lalu hapus.
export const categoryDeleteQuerySchema = z.object({
  detach: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
});
export type CategoryDeleteQuery = z.infer<typeof categoryDeleteQuerySchema>;

// ===== Grid kategori publik (/pelatihan) =====

export const PUBLIC_CATEGORY_PAGE_SIZE = 24;

// Huruf indeks A-Z grid kategori: satu huruf A-Z, atau "#" untuk nama berawalan angka/simbol.
export const CATEGORY_INDEX_LETTER = /^[A-Z#]$/;

// GET /api/public/categories?q=&huruf=&page=. Nilai tak dikenal diabaikan (URL bisa diketik
// sembarang); page di luar batas dijepit service ke halaman terakhir yang valid.
export const publicCategoryGridQuerySchema = z.object({
  q: z
    .string()
    .transform((value) => value.replace(/\s+/g, " ").trim().slice(0, 100))
    .optional()
    .catch(undefined)
    .transform((value) => value || undefined),
  huruf: z
    .string()
    .transform((value) => value.trim().toUpperCase())
    .pipe(z.string().regex(CATEGORY_INDEX_LETTER))
    .optional()
    .catch(undefined),
  page: z.coerce.number().int().min(1).max(1000).default(1).catch(1),
});
export type PublicCategoryGridQuery = z.infer<typeof publicCategoryGridQuerySchema>;

// trainingCount = jumlah pelatihan aktif (bukan di Sampah), dihitung di service.
export const CATEGORY_SORT_FIELDS = ["order", "name", "updatedAt", "createdAt", "trainingCount"] as const;

export const categoryListQuerySchema = listQuerySchema({
  sortFields: CATEGORY_SORT_FIELDS,
  defaultSort: "order",
  extra: {
    featured: z
      .enum(["true", "false"])
      .optional()
      .transform((value) => (value === undefined ? undefined : value === "true")),
    // issue=no-image: kategori tanpa gambar.
    issue: z.enum(["no-image"]).optional(),
  },
});
export type CategoryListQuery = z.infer<typeof categoryListQuerySchema>;

// Daftar judul pelatihan di landing kategori: 20 per halaman, cari judul di server
// (GET /api/public/categories/:slug/trainings?hal=&q=). Nilai tidak valid diabaikan, bukan error.
export const CATEGORY_TRAININGS_PAGE_SIZE = 20;
export const publicCategoryTrainingsQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .max(100)
    .optional()
    .catch(undefined)
    .transform((value) => value || undefined),
  hal: z.coerce.number().int().min(1).max(1000).default(1).catch(1),
});
export type PublicCategoryTrainingsQuery = z.infer<typeof publicCategoryTrainingsQuerySchema>;
