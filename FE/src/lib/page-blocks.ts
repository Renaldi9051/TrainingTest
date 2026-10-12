import { z } from "zod";
import type { PageBlock, PageBlockType, RichTextDoc } from "@/lib/api/types";

// Logika state editor blok halaman (tanpa UI), supaya bisa diuji Vitest. Batas & aturan wajib
// mengikuti BE/src/lib/validators/page-blocks.ts; BE tetap memvalidasi ulang saat simpan.

export const PAGE_BLOCKS_MAX = 40;
export const FEATURES_MAX = 12;
export const LIST_ITEMS_MAX = 30;
export const MISSION_ITEMS_MAX = 10;
export const SERVICES_LIMIT_MAX = 12;
export const SERVICES_LIMIT_DEFAULT = 4;

export const PAGE_BLOCK_TYPES = [
  "RICH_TEXT",
  "VISION_MISSION",
  "FEATURES",
  "LIST",
  "SERVICES",
  "IMAGE",
  "DOWNLOAD",
] as const satisfies readonly PageBlockType[];

export const PAGE_BLOCK_LABELS: Record<PageBlockType, string> = {
  RICH_TEXT: "Teks",
  VISION_MISSION: "Visi & misi",
  FEATURES: "Keunggulan",
  LIST: "Daftar",
  SERVICES: "Layanan",
  IMAGE: "Gambar",
  DOWNLOAD: "Unduhan",
};

export const PAGE_BLOCK_DESCRIPTIONS: Record<PageBlockType, string> = {
  RICH_TEXT: "Judul dan paragraf, mis. tentang kami atau isi halaman statis.",
  VISION_MISSION: "Visi, daftar misi, dan moto.",
  FEATURES: "Kartu keunggulan dengan ikon.",
  LIST: "Daftar poin atau chip, mis. target peserta.",
  SERVICES: "Layanan dari modul Layanan (otomatis atau pilih manual).",
  IMAGE: "Satu gambar dengan keterangan.",
  DOWNLOAD: "Tombol unduh PDF, mis. company profile.",
};

export function createBlock(type: PageBlockType, id: string = crypto.randomUUID()): PageBlock {
  const heading = { eyebrow: "", heading: "" };
  switch (type) {
    case "RICH_TEXT":
      return { id, type, ...heading, body: null };
    case "VISION_MISSION":
      return { id, type, eyebrow: "", vision: "", mission: [""], motto: "" };
    case "FEATURES":
      return { id, type, ...heading, items: [{ title: "", description: "", icon: null }] };
    case "LIST":
      return { id, type, ...heading, style: "bullet", items: [""] };
    case "SERVICES":
      return { id, type, ...heading, intro: "", mode: "auto", limit: SERVICES_LIMIT_DEFAULT, ids: [] };
    case "IMAGE":
      return { id, type, image: null, caption: "" };
    case "DOWNLOAD":
      return { id, type, ...heading, description: "", label: "Unduh company profile", file: null };
  }
}

// Tambah di akhir. Daftar penuh: tidak berubah (tombol tambah sudah dinonaktifkan di UI).
export function addBlock(blocks: PageBlock[], block: PageBlock): PageBlock[] {
  if (blocks.length >= PAGE_BLOCKS_MAX) return blocks;
  return [...blocks, block];
}

export function updateBlock(blocks: PageBlock[], next: PageBlock): PageBlock[] {
  return blocks.map((block) => (block.id === next.id ? next : block));
}

export type RemovedBlock = { block: PageBlock; index: number };

// Hapus blok; hasilnya dipakai "Urungkan" untuk mengembalikan ke posisi semula.
export function removeBlock(blocks: PageBlock[], id: string): { blocks: PageBlock[]; removed: RemovedBlock | null } {
  const index = blocks.findIndex((block) => block.id === id);
  if (index < 0) return { blocks, removed: null };
  return { blocks: blocks.filter((block) => block.id !== id), removed: { block: blocks[index], index } };
}

// Kembalikan blok yang dihapus ke posisinya (atau ke akhir kalau daftar sudah lebih pendek).
// Blok dengan id sama sudah ada: tidak dobel.
export function restoreBlock(blocks: PageBlock[], removed: RemovedBlock): PageBlock[] {
  if (blocks.some((block) => block.id === removed.block.id)) return blocks;
  const index = Math.min(removed.index, blocks.length);
  return [...blocks.slice(0, index), removed.block, ...blocks.slice(index)];
}

// Urutan baru dari daftar id (hasil drag & drop). Id asing diabaikan; blok yang tidak disebut
// tetap ikut di akhir supaya tidak ada yang hilang.
export function reorderBlocks(blocks: PageBlock[], ids: string[]): PageBlock[] {
  const byId = new Map(blocks.map((block) => [block.id, block]));
  const ordered = ids.flatMap((id) => byId.get(id) ?? []);
  const seen = new Set(ordered.map((block) => block.id));
  return [...ordered, ...blocks.filter((block) => !seen.has(block.id))];
}

// Index blok yang punya error dari key field API, mis. "blocks.3.file" -> 3.
export function blockIndexesFromFieldKeys(keys: readonly string[]): number[] {
  const indexes = keys.flatMap((key) => {
    const match = /^blocks\.(\d+)(\.|$)/.exec(key);
    return match ? [Number(match[1])] : [];
  });
  return [...new Set(indexes)].sort((a, b) => a - b);
}

// Index blok yang punya error di objek error React Hook Form (errors.blocks), yang berbentuk
// array jarang (sparse) atau objek ber-index.
export function blockIndexesFromFormErrors(errors: unknown): number[] {
  if (!errors || typeof errors !== "object") return [];
  return Object.keys(errors)
    .filter((key) => /^\d+$/.test(key) && (errors as Record<string, unknown>)[key])
    .map(Number)
    .sort((a, b) => a - b);
}

function richTextText(doc: RichTextDoc | null): string {
  const walk = (nodes: RichTextDoc["content"] | undefined): string =>
    (nodes ?? []).map((node) => (node.text ?? "") + " " + walk(node.content)).join(" ");
  return doc ? walk(doc.content).replace(/\s+/g, " ").trim() : "";
}

// Ringkasan satu baris untuk kepala kartu blok yang terlipat.
export function blockSummary(block: PageBlock): string {
  switch (block.type) {
    case "RICH_TEXT":
      return block.heading || richTextText(block.body).slice(0, 80);
    case "VISION_MISSION":
      return block.vision.slice(0, 80);
    case "FEATURES":
      return block.heading || `${block.items.length} keunggulan`;
    case "LIST":
      return block.heading || `${block.items.length} item`;
    case "SERVICES":
      return block.heading || (block.mode === "auto" ? `Otomatis, ${block.limit} layanan` : `${block.ids.length} layanan dipilih`);
    case "IMAGE":
      return block.caption || (block.image ? "Gambar dipilih" : "Belum ada gambar");
    case "DOWNLOAD":
      return block.heading || block.label;
  }
}

// ===== Validasi form (path error sama dengan BE: blocks.N.field) =====

const requiredText = (label: string, max: number) =>
  z
    .string()
    .trim()
    .min(1, { error: `${label} wajib diisi.` })
    .max(max, { error: `${label} maksimal ${max} karakter.` });
const optionalText = (label: string, max: number) =>
  z.string().trim().max(max, { error: `${label} maksimal ${max} karakter.` });

const headingShape = { eyebrow: optionalText("Eyebrow", 40), heading: optionalText("Judul", 120) };
const mediaRef = z.object({ mediaId: z.string() });
const richTextDoc = z.custom<RichTextDoc | null>((value) => value === null || typeof value === "object");

export const pageBlockFormSchema = z.discriminatedUnion("type", [
  z.object({
    id: z.string(),
    type: z.literal("RICH_TEXT"),
    ...headingShape,
    body: richTextDoc.refine((doc) => richTextText(doc) !== "", { error: "Isi teks wajib diisi." }),
  }),
  z.object({
    id: z.string(),
    type: z.literal("VISION_MISSION"),
    eyebrow: optionalText("Eyebrow", 40),
    vision: requiredText("Visi", 600),
    mission: z
      .array(requiredText("Misi", 300))
      .min(1, { error: "Isi minimal satu misi." })
      .max(MISSION_ITEMS_MAX, { error: `Misi maksimal ${MISSION_ITEMS_MAX} item.` }),
    motto: optionalText("Moto", 200),
  }),
  z.object({
    id: z.string(),
    type: z.literal("FEATURES"),
    ...headingShape,
    items: z
      .array(
        z.object({
          title: requiredText("Judul keunggulan", 80),
          description: optionalText("Deskripsi", 300),
          icon: z.string().nullable(),
        }),
      )
      .min(1, { error: "Isi minimal satu keunggulan." })
      .max(FEATURES_MAX, { error: `Keunggulan maksimal ${FEATURES_MAX} item.` }),
  }),
  z.object({
    id: z.string(),
    type: z.literal("LIST"),
    ...headingShape,
    style: z.enum(["bullet", "chips"]),
    items: z
      .array(requiredText("Item", 160))
      .min(1, { error: "Isi minimal satu item." })
      .max(LIST_ITEMS_MAX, { error: `Daftar maksimal ${LIST_ITEMS_MAX} item.` }),
  }),
  z
    .object({
      id: z.string(),
      type: z.literal("SERVICES"),
      ...headingShape,
      intro: optionalText("Pengantar", 300),
      mode: z.enum(["auto", "manual"]),
      limit: z
        .number({ error: "Jumlah harus berupa angka." })
        .int({ error: "Jumlah harus bilangan bulat." })
        .min(1, { error: "Jumlah minimal 1." })
        .max(SERVICES_LIMIT_MAX, { error: `Jumlah maksimal ${SERVICES_LIMIT_MAX}.` }),
      ids: z.array(z.string()).max(SERVICES_LIMIT_MAX, { error: `Maksimal ${SERVICES_LIMIT_MAX} item.` }),
    })
    .superRefine((value, ctx) => {
      if (value.mode === "manual" && value.ids.length === 0) {
        ctx.addIssue({ code: "custom", path: ["ids"], message: "Pilih minimal satu item untuk mode manual." });
      }
    }),
  z.object({
    id: z.string(),
    type: z.literal("IMAGE"),
    image: mediaRef.nullable().refine((value) => value !== null, { error: "Pilih gambar." }),
    caption: optionalText("Keterangan", 200),
  }),
  z.object({
    id: z.string(),
    type: z.literal("DOWNLOAD"),
    ...headingShape,
    description: optionalText("Deskripsi", 300),
    label: requiredText("Label tombol", 60),
    file: mediaRef.nullable(),
  }),
]);

export const pageBlocksFormSchema = z
  .array(pageBlockFormSchema)
  .max(PAGE_BLOCKS_MAX, { error: `Blok maksimal ${PAGE_BLOCKS_MAX}.` });
