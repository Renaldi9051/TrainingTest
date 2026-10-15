import { z } from "zod";
import type { PageKind } from "@/generated/prisma/client";
import { contentStatusFilter, listQuerySchema } from "@/lib/list-query";
import { optionalSlugSchema } from "@/lib/slug";
import { requiredText, seoSchema } from "@/lib/validators/common";
import { pageBlocksSchema } from "@/lib/validators/page-blocks";

// Halaman profil = halaman sistem: satu-satunya kind PROFILE, tampil di /profil, slug terkunci.
export const PROFILE_SLUG = "profil";

// Halaman statis tampil di /[slug], jadi slug-nya tidak boleh sama dengan segmen route lain di FE
// (FE/src/app) atau path yang dilayani khusus (api, uploads, file metadata Next).
// "profil" boleh dipakai hanya oleh halaman PROFILE.
export const RESERVED_PAGE_SLUGS = new Set([
  PROFILE_SLUG,
  "layanan",
  "pelatihan",
  "jadwal",
  "kontak",
  "admin",
  "api",
  "uploads",
  "beranda",
  "sitemap",
  "robots",
  "manifest",
  "favicon",
  "icon",
  "apple-icon",
  "opengraph-image",
  "twitter-image",
]);

export const PAGE_SLUG_RESERVED_MESSAGE = "Slug ini dipakai halaman lain di situs. Ganti dengan slug lain.";
export const PROFILE_SLUG_LOCKED_MESSAGE = "Slug halaman profil tidak bisa diubah.";

// null = slug boleh dipakai halaman dengan kind ini. Dicek di service (bukan di skema) karena
// aturannya bergantung pada kind halaman yang tersimpan.
export function pageSlugIssue(slug: string, kind: PageKind): string | null {
  if (kind === "PROFILE") return slug === PROFILE_SLUG ? null : PROFILE_SLUG_LOCKED_MESSAGE;
  return RESERVED_PAGE_SLUGS.has(slug) ? PAGE_SLUG_RESERVED_MESSAGE : null;
}

const statusSchema = z.enum(["DRAFT", "PUBLISHED"], { error: "Status tidak dikenal." });

const pageFields = {
  title: requiredText("Judul", 200),
  slug: optionalSlugSchema,
  blocks: pageBlocksSchema,
  status: statusSchema,
  seo: seoSchema,
};

// Lewat API hanya bisa membuat halaman STANDARD; halaman PROFILE dibuat seed.
export const pageCreateSchema = z.object({
  ...pageFields,
  blocks: pageFields.blocks.default([]),
  status: pageFields.status.default("DRAFT"),
  seo: seoSchema.default({ title: "", description: "", ogImageId: null }),
});
export type PageCreateInput = z.infer<typeof pageCreateSchema>;

export const pageUpdateSchema = z
  .object({
    title: pageFields.title.optional(),
    slug: pageFields.slug,
    blocks: pageFields.blocks.optional(),
    status: pageFields.status.optional(),
    seo: pageFields.seo.optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    error: "Tidak ada perubahan yang dikirim.",
  });
export type PageUpdateInput = z.infer<typeof pageUpdateSchema>;

export const PAGE_SORT_FIELDS = ["updatedAt", "createdAt", "title"] as const;

export const pageListQuerySchema = listQuerySchema({
  sortFields: PAGE_SORT_FIELDS,
  defaultSort: "-updatedAt",
  extra: { status: contentStatusFilter },
});
export type PageListQuery = z.infer<typeof pageListQuerySchema>;
