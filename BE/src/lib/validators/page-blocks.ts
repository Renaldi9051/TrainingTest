import { z } from "zod";
import { mediaRefObjectSchema, type TypedMediaRef } from "@/lib/media-refs";
import { isRichTextEmpty, richTextSchema } from "@/lib/rich-text";
import { iconSchema } from "@/lib/validators/category";
import { plainText, requiredText } from "@/lib/validators/common";
import {
  headingFields,
  INTRO_MAX,
  requireManualIds,
  selectionFields,
  visionMissionFields,
} from "@/lib/validators/content-common";

// Blok konten halaman (Page.blocks): halaman profil dan halaman statis. Setiap blok punya `id`
// (uuid, dibuat FE) sebagai key urutan drag & drop dan label "media dipakai di mana".
// Media: { mediaId } (lihat lib/media-refs.ts). Rich text memakai allowlist yang sama dengan
// pelatihan dan divalidasi ulang saat render.

export const PAGE_BLOCK_TYPES = [
  "RICH_TEXT",
  "VISION_MISSION",
  "FEATURES",
  "LIST",
  "SERVICES",
  "IMAGE",
  "DOWNLOAD",
] as const;
export type PageBlockType = (typeof PAGE_BLOCK_TYPES)[number];

export const PAGE_BLOCK_LABELS: Record<PageBlockType, string> = {
  RICH_TEXT: "Teks",
  VISION_MISSION: "Visi & misi",
  FEATURES: "Keunggulan",
  LIST: "Daftar",
  SERVICES: "Layanan",
  IMAGE: "Gambar",
  DOWNLOAD: "Unduhan",
};

export const PAGE_BLOCKS_MAX = 40;
export const FEATURES_MAX = 12;
export const LIST_ITEMS_MAX = 30;
export const LIST_STYLES = ["bullet", "chips"] as const;

const blockId = z.uuid({ error: "ID blok tidak valid." });

const richTextBlock = z.object({
  id: blockId,
  type: z.literal("RICH_TEXT"),
  ...headingFields,
  body: richTextSchema.refine((doc) => !isRichTextEmpty(doc), { error: "Isi teks wajib diisi." }),
});

const visionMissionBlock = z.object({
  id: blockId,
  type: z.literal("VISION_MISSION"),
  ...visionMissionFields,
});

const featuresBlock = z.object({
  id: blockId,
  type: z.literal("FEATURES"),
  ...headingFields,
  items: z
    .array(
      z.object({
        title: requiredText("Judul keunggulan", 80),
        description: plainText("Deskripsi", 300),
        icon: iconSchema.default(null),
      }),
    )
    .min(1, { error: "Isi minimal satu keunggulan." })
    .max(FEATURES_MAX, { error: `Keunggulan maksimal ${FEATURES_MAX} item.` }),
});

const listBlock = z.object({
  id: blockId,
  type: z.literal("LIST"),
  ...headingFields,
  style: z.enum(LIST_STYLES, { error: "Gaya daftar tidak dikenal." }).default("bullet"),
  items: z
    .array(requiredText("Item", 160))
    .min(1, { error: "Isi minimal satu item." })
    .max(LIST_ITEMS_MAX, { error: `Daftar maksimal ${LIST_ITEMS_MAX} item.` }),
});

// Referensi ke Service (bukan salinan): auto = layanan publik sesuai urutan, manual = pilihan.
const servicesBlock = z
  .object({
    id: blockId,
    type: z.literal("SERVICES"),
    ...headingFields,
    intro: plainText("Pengantar", INTRO_MAX),
    ...selectionFields({ defaultLimit: 4, maxLimit: 12 }),
  })
  .superRefine(requireManualIds);

const imageBlock = z.object({
  id: blockId,
  type: z.literal("IMAGE"),
  image: z.object(mediaRefObjectSchema.shape, { error: "Pilih gambar." }),
  caption: plainText("Keterangan", 200),
});

// File boleh kosong (mis. belum diunggah); blok tanpa file aktif tidak tampil di publik.
const downloadBlock = z.object({
  id: blockId,
  type: z.literal("DOWNLOAD"),
  ...headingFields,
  description: plainText("Deskripsi", 300),
  label: requiredText("Label tombol", 60),
  file: mediaRefObjectSchema.nullable().default(null),
});

export const pageBlockSchema = z.discriminatedUnion(
  "type",
  [richTextBlock, visionMissionBlock, featuresBlock, listBlock, servicesBlock, imageBlock, downloadBlock],
  { error: "Tipe blok tidak dikenal." },
);
export type PageBlock = z.infer<typeof pageBlockSchema>;

export const pageBlocksSchema = z
  .array(pageBlockSchema)
  .max(PAGE_BLOCKS_MAX, { error: `Blok maksimal ${PAGE_BLOCKS_MAX}.` })
  .refine((blocks) => new Set(blocks.map((block) => block.id)).size === blocks.length, {
    error: "ID blok tidak boleh dobel.",
  });

// Blok tersimpan dibaca ulang dengan skema yang sama: blok yang rusak dilewati satu per satu,
// bukan menggagalkan seluruh halaman.
export function parseStoredBlocks(value: unknown): PageBlock[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const parsed = pageBlockSchema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
}

// Semua referensi media per blok dengan jenis yang diharapkan. Path relatif terhadap array blok
// ("3.file"). Harus selalu sama dengan collectMediaRefs (dijaga test).
export function pageBlockMediaRefs(blocks: PageBlock[]): TypedMediaRef[] {
  return blocks.flatMap((block, index): TypedMediaRef[] => {
    switch (block.type) {
      case "IMAGE":
        return [{ path: `${index}.image`, mediaId: block.image.mediaId, kind: "image", requireAlt: true }];
      case "DOWNLOAD":
        return block.file
          ? [{ path: `${index}.file`, mediaId: block.file.mediaId, kind: "pdf", requireAlt: false }]
          : [];
      case "RICH_TEXT":
      case "VISION_MISSION":
      case "FEATURES":
      case "LIST":
      case "SERVICES":
        return [];
    }
  });
}
