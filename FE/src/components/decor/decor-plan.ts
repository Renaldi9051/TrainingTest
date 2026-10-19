// Fungsi murni komponen decor/ (dites di Vitest).

// "01", "02", ... dari urutan (mulai 1).
export function formatIndex(position: number): string {
  return String(position).padStart(2, "0");
}

// Posisi gambar ImageStack (DESIGN.md 6.1): 1 gambar memenuhi kotak; 2-3 gambar saling tumpuk
// (belakang besar kiri atas, depan kanan tengah, bawah kecil). Maksimal 3, sisanya diabaikan.
export type ImageStackSlot = "single" | "back" | "front" | "low";

export function imageStackSlots(count: number): ImageStackSlot[] {
  if (count <= 0) return [];
  if (count === 1) return ["single"];
  return (["back", "front", "low"] as const).slice(0, Math.min(count, 3));
}
