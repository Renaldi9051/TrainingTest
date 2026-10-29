// Logika hero slideshow tanpa UI (DESIGN.md 8.1). Fungsi murni, dites di Vitest.

export type SlideBlockers = {
  // Kursor di atas hero.
  hover: boolean;
  // Fokus keyboard di dalam hero.
  focus: boolean;
  // Tab browser tidak aktif.
  hidden: boolean;
  // Hero di luar layar.
  offscreen: boolean;
  // prefers-reduced-motion: tanpa autoplay.
  reduced: boolean;
  // Slide selain yang pertama belum dipasang (dimuat setelah event load halaman).
  pending: boolean;
};

export function autoplayAllowed(count: number, blockers: SlideBlockers): boolean {
  return count > 1 && !Object.values(blockers).some(Boolean);
}

export function nextSlide(current: number, count: number): number {
  return count > 0 ? (current + 1) % count : 0;
}

// Isi bar progres per segmen (0..1): segmen sebelum slide aktif penuh, sesudahnya kosong, slide
// aktif sesuai waktu berjalan. Reduced motion: slide aktif penuh (tanpa progres berjalan).
export function segmentFill(index: number, active: number, elapsedMs: number, intervalMs: number, reduced: boolean): number {
  if (index < active) return 1;
  if (index > active) return 0;
  if (reduced) return 1;
  return Math.min(1, Math.max(0, elapsedMs / intervalMs));
}

// "01 / 04".
export function slideCounter(index: number, count: number): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(index + 1)} / ${pad(count)}`;
}
