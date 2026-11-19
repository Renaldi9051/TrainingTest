// Palet halaman publik (fitur ganti palet, belum dari CMS). Setiap id punya satu blok token
// :root:has([data-palette="<id>"]) di app/(public)/palette-<...>.css dengan nama token yang sama.
// Nilai ini dipasang sebagai atribut data-palette di <main> layout publik.
export const PALETTES = ["malam-hujan", "palet-e"] as const;

export type PaletteId = (typeof PALETTES)[number];

// Malam Hujan v2 (19 Nov 2026) menggantikan palet E sebagai palet aktif.
export const DEFAULT_PALETTE: PaletteId = "malam-hujan";
