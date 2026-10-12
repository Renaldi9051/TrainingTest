import { z } from "zod";
import { idSchema, plainText, requiredText } from "@/lib/validators/common";

// Potongan skema yang dipakai bersama section beranda (home-section.ts) dan blok halaman
// (page-blocks.ts). Teks opsional di JSON disimpan sebagai string kosong, bukan null.

export const EYEBROW_MAX = 40;
export const HEADING_MAX = 120;
export const INTRO_MAX = 300;

export const headingFields = {
  eyebrow: plainText("Eyebrow", EYEBROW_MAX),
  heading: plainText("Judul", HEADING_MAX),
};

// Section/blok berbasis data hanya menyimpan konfigurasi, bukan salinan data.
// auto  : diambil otomatis dari data publik (urutan & aturan per type), dibatasi `limit`.
// manual: id pilihan admin, tampil sesuai urutan `ids`; id yang dihapus/draft tersaring saat resolve.
// `ids` tetap disimpan di mode auto supaya pilihan tidak hilang saat admin berpindah mode.
export const SELECTION_MODES = ["auto", "manual"] as const;
export type SelectionMode = (typeof SELECTION_MODES)[number];

export function selectionFields(options: { defaultLimit: number; maxLimit: number }) {
  return {
    mode: z.enum(SELECTION_MODES, { error: "Mode tidak dikenal." }).default("auto"),
    limit: z
      .number({ error: "Jumlah harus berupa angka." })
      .int({ error: "Jumlah harus bilangan bulat." })
      .min(1, { error: "Jumlah minimal 1." })
      .max(options.maxLimit, { error: `Jumlah maksimal ${options.maxLimit}.` })
      .default(options.defaultLimit),
    ids: z
      .array(idSchema)
      .max(options.maxLimit, { error: `Maksimal ${options.maxLimit} item.` })
      .refine((ids) => new Set(ids).size === ids.length, { error: "Item tidak boleh dobel." })
      .default([]),
  };
}

// Mode manual wajib punya minimal satu pilihan. Dipakai sebagai .superRefine di objek yang
// memakai selectionFields (refinement Zod 4 tidak membungkus objek, jadi tetap bisa masuk
// discriminatedUnion).
export function requireManualIds(value: { mode: SelectionMode; ids: string[] }, ctx: z.RefinementCtx) {
  if (value.mode === "manual" && value.ids.length === 0) {
    ctx.addIssue({ code: "custom", path: ["ids"], message: "Pilih minimal satu item untuk mode manual." });
  }
}

export const VISION_MAX = 600;
export const MISSION_ITEMS_MAX = 10;
export const MISSION_ITEM_MAX = 300;
export const MOTTO_MAX = 200;

export const visionMissionFields = {
  eyebrow: plainText("Eyebrow", EYEBROW_MAX),
  vision: requiredText("Visi", VISION_MAX),
  mission: z
    .array(requiredText("Misi", MISSION_ITEM_MAX))
    .min(1, { error: "Isi minimal satu misi." })
    .max(MISSION_ITEMS_MAX, { error: `Misi maksimal ${MISSION_ITEMS_MAX} item.` }),
  motto: plainText("Moto", MOTTO_MAX),
};
