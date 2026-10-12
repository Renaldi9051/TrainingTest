// Bentuk item untuk picker & panel urutkan admin (GET /api/admin/{resource}/options).
export type OptionItem = {
  id: string;
  label: string;
  // Keterangan kecil, mis. instansi testimoni atau "Draf".
  sublabel: string | null;
  // Thumbnail (varian terkecil) kalau entitas punya gambar.
  imageUrl: string | null;
};

// Hasil pencarian + item terpilih yang belum ikut (urutan: hasil pencarian dulu).
export async function withSelected<T extends { id: string }>(
  rows: T[],
  selectedIds: string[],
  loadByIds: (ids: string[]) => Promise<T[]>,
): Promise<T[]> {
  const present = new Set(rows.map((row) => row.id));
  const missing = selectedIds.filter((id) => !present.has(id));
  if (missing.length === 0) return rows;
  return [...rows, ...(await loadByIds(missing))];
}
