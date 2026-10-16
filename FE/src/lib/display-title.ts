// Judul pelatihan untuk tampilan publik. Validator admin menolak judul kosong, tapi data lama hasil
// impor bisa kosong: tampil label UI "Tanpa judul" supaya heading dan tautan tidak kosong.
export const UNTITLED = "Tanpa judul";

export function displayTitle(title: string | null | undefined): string {
  return title?.trim() || UNTITLED;
}

export function isUntitled(title: string | null | undefined): boolean {
  return !title?.trim();
}
