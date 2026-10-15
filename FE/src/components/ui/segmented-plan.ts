// Navigasi keyboard SegmentedToggle (pola radiogroup WAI-ARIA): panah kiri/atas = sebelumnya,
// panah kanan/bawah = berikutnya (memutar), Home/End = pertama/terakhir. null = tombol lain,
// biarkan browser. Fungsi murni, dites di Vitest.
export function segmentKeyTarget(current: number, key: string, count: number): number | null {
  if (count <= 0) return null;
  switch (key) {
    case "ArrowRight":
    case "ArrowDown":
      return (current + 1) % count;
    case "ArrowLeft":
    case "ArrowUp":
      return (current - 1 + count) % count;
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return null;
  }
}
