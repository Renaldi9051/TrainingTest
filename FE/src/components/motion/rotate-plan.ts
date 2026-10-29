// Kata berganti di hero (DESIGN.md 9.2): berulang tiap interval dari CMS (default ROTATE_INTERVAL_MS).
// Ditahan saat tidak terlihat (tab tidak aktif atau hero di luar layar), lalu lanjut dari kata yang
// sedang tampil. Tanpa tombol pause (pemilik, 29 Okt 2026). Fungsi murni, dites di Vitest.

export type RotateBlockers = {
  // Tab tidak aktif.
  hidden: boolean;
  // Hero tidak terlihat di layar.
  offscreen: boolean;
};

export function nextRotateIndex(current: number, count: number): number {
  return count > 0 ? (current + 1) % count : 0;
}

export function shouldRotate(count: number, blockers: RotateBlockers): boolean {
  return count > 1 && !blockers.hidden && !blockers.offscreen;
}
