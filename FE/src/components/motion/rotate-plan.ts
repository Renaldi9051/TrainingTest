// Kata berganti di hero (DESIGN.md 8.2): berulang terus tiap ROTATE_INTERVAL_MS. Berhenti sementara
// (di kata yang sedang tampil) saat dijeda lewat tombol, kursor di atas judul, tab tidak aktif, atau
// hero di luar layar; lanjut dari kata itu. Fungsi murni, dites di Vitest.

export type RotateBlockers = {
  // Dijeda pengunjung lewat tombol Jeda (WCAG 2.2.2).
  paused: boolean;
  // Kursor di atas judul (sedang dibaca).
  hovered: boolean;
  // Tab tidak aktif.
  hidden: boolean;
  // Hero tidak terlihat di layar.
  offscreen: boolean;
};

export function nextRotateIndex(current: number, count: number): number {
  return count > 0 ? (current + 1) % count : 0;
}

export function shouldRotate(count: number, blockers: RotateBlockers): boolean {
  return count > 1 && !blockers.paused && !blockers.hovered && !blockers.hidden && !blockers.offscreen;
}
