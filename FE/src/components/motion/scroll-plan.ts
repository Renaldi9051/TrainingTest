// Progres baca & scroll-spy daftar isi (DESIGN.md 8.2, BACKLOG). Fungsi murni, dites di Vitest.

// Progres scroll dokumen 0..1.
export function readingProgress(scrollY: number, scrollHeight: number, viewportHeight: number): number {
  const max = scrollHeight - viewportHeight;
  if (max <= 0) return 1;
  return Math.min(1, Math.max(0, scrollY / max));
}

// Bagian aktif: bagian terakhir yang tepi atasnya sudah melewati garis baca (di bawah header);
// sebelum bagian pertama = bagian pertama; di dasar halaman = bagian terakhir.
export function activeSection(tops: number[], line: number, atBottom: boolean): number {
  if (tops.length === 0) return -1;
  if (atBottom) return tops.length - 1;
  let active = 0;
  tops.forEach((top, index) => {
    if (top <= line) active = index;
  });
  return active;
}
