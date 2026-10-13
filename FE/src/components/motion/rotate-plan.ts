import { ROTATE_INTERVAL_MS, ROTATE_SWAP_MS, ROTATE_TOTAL_MS } from "./tokens";

// Jadwal kata berganti di hero (DESIGN.md 8.2): satu putaran lalu berhenti di kata pertama, selesai
// <= 5 s sejak halaman tampil; jeda dipadatkan kalau kata > 2. Fungsi murni, dites di Vitest.

export type RotateStep = { at: number; from: number; to: number };

export function rotateSchedule(count: number): RotateStep[] {
  if (count <= 1) return [];
  // count pergantian (ke kata 2..n, lalu kembali ke kata 1); pergantian terakhir selesai <= total.
  const interval = Math.min(ROTATE_INTERVAL_MS, Math.floor((ROTATE_TOTAL_MS - ROTATE_SWAP_MS) / count));
  return Array.from({ length: count }, (_, index) => ({
    at: interval * (index + 1),
    from: index,
    to: (index + 1) % count,
  }));
}
