import { z } from "zod";
import { listQuerySchema } from "@/lib/list-query";
import { optionalSlugSchema } from "@/lib/slug";
import { nullableText, requiredText } from "@/lib/validators/common";

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
  "warehouse",
  "wrench",
  "zap",
] as const;

export type CategoryIcon = (typeof CATEGORY_ICONS)[number];

const iconSchema = z
  .enum(CATEGORY_ICONS, { error: "Ikon tidak dikenal. Pilih dari daftar ikon." })
  .nullable();

export const categoryCreateSchema = z.object({
  name: requiredText("Nama", 100),
  slug: optionalSlugSchema,
  description: nullableText("Deskripsi", 1000).default(null),
  icon: iconSchema.default(null),
  featured: z.boolean().default(false),
});
export type CategoryCreateInput = z.infer<typeof categoryCreateSchema>;

export const categoryUpdateSchema = z
  .object({
    name: requiredText("Nama", 100).optional(),
    slug: optionalSlugSchema,
    description: nullableText("Deskripsi", 1000),
    icon: iconSchema.optional(),
    featured: z.boolean().optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    error: "Tidak ada perubahan yang dikirim.",
  });
export type CategoryUpdateInput = z.infer<typeof categoryUpdateSchema>;

export const CATEGORY_SORT_FIELDS = ["order", "name", "updatedAt", "createdAt"] as const;

export const categoryListQuerySchema = listQuerySchema({
  sortFields: CATEGORY_SORT_FIELDS,
  defaultSort: "order",
  extra: {
    featured: z
      .enum(["true", "false"])
      .optional()
      .transform((value) => (value === undefined ? undefined : value === "true")),
  },
});
export type CategoryListQuery = z.infer<typeof categoryListQuerySchema>;
