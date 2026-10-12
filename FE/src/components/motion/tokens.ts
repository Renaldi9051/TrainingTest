// Token gerak DESIGN.md 8 (detik, untuk Motion). Acuan rasa gerak: blueprint prototipe; kalau
// blueprint berbeda dengan DESIGN.md, nilai DESIGN.md yang dipakai (lihat catatan per token).

// Easing standar; sama dengan --ease-standard di globals.css (dijaga test).
export const EASE = [0.22, 1, 0.36, 1] as const;

export const DURATION = {
  // Hover, fokus.
  fast: 0.15,
  // Buka/tutup, transisi state, ganti kata.
  normal: 0.3,
  // Reveal saat scroll. Blueprint memakai 0,5-0,9 s per jenis; DESIGN.md: 600 ms.
  slow: 0.6,
} as const;

export const STAGGER = {
  // Daftar & baris tabel.
  list: 0.04,
  // Kata judul section.
  word: 0.05,
  // Kartu grid.
  card: 0.08,
  // Swatch / ikon / chip.
  chip: 0.05,
} as const;

// Kartu di kolom kanan sedikit lebih lambat (blueprint: +60 ms per kolom).
export const CARD_COLUMN_DELAY = 0.06;

// Geser masuk daftar & kartu (px).
export const REVEAL_SHIFT_PX = 16;

// Kapan reveal dipicu: 10% sebelum dasar viewport (DESIGN.md 8.2). Blueprint memicu 12% sebelum
// elemen terlihat; DESIGN.md yang dipakai.
export const IN_VIEW_MARGIN = "0px 0px -10% 0px";

// Kata judul naik dari balik garis.
export const WORD_RISE = "105%";

// Gambar: wipe dari bawah + zoom dari 1,15.
export const IMAGE_ZOOM_FROM = 1.15;

// Eyebrow scramble. Blueprint 450 ms; DESIGN.md 300 ms.
export const SCRAMBLE_MS = 300;

// Counter statistik (ease-out cubic, seperti blueprint).
export const COUNTER_MS = 900;

// Kata berganti di hero.
export const ROTATE_INTERVAL_MS = 2200;

// Tombol magnetic: geser maksimal (px).
export const MAGNETIC_MAX_PX = 6;

// Jeda total satu elemen dalam grup yang berbaris (stagger) + kolom.
export function staggerDelay(index: number, step: number, column = 0): number {
  return Number((index * step + column * CARD_COLUMN_DELAY).toFixed(3));
}
