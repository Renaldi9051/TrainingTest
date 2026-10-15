// Geser horizontal pelan teks outline raksasa mengikuti progres scroll (DESIGN.md 9.2): maksimal
// PARALLAX_MAX_PX ke kanan saat section baru masuk dari bawah, 0 di tengah layar, ke kiri saat
// keluar di atas. Fungsi murni, dites di Vitest.

export const PARALLAX_MAX_PX = 80;

// top/height: posisi section (getBoundingClientRect); viewport: tinggi layar.
export function parallaxOffset(top: number, height: number, viewport: number, max = PARALLAX_MAX_PX): number {
  const travel = viewport + height;
  if (travel <= 0) return 0;
  const progress = Math.min(1, Math.max(0, (viewport - top) / travel));
  return Number(((0.5 - progress) * 2 * max).toFixed(2));
}
