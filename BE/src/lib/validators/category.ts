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

export const categoryCreateSchema = z.object({
  name: requiredText("Nama", 100),
  slug: optionalSlugSchema,
  description: nullableText("Deskripsi", 1000).default(null),
  icon: iconSchema.default(null),
  featured: z.boolean().default(false),
  // Gambar kategori (media library, alt wajib): fallback sampul pelatihan tanpa cover.
  imageId: idSchema.nullable().default(null),
  keywords: keywordsSchema.default([]),
});
export type CategoryCreateInput = z.infer<typeof categoryCreateSchema>;

export const categoryUpdateSchema = z
  .object({
    name: requiredText("Nama", 100).optional(),
    slug: optionalSlugSchema,
    description: nullableText("Deskripsi", 1000),
    icon: iconSchema.optional(),
    featured: z.boolean().optional(),
    imageId: idSchema.nullable().optional(),
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
