import { toWibInputValue } from "@/lib/format";

// Kalender jadwal posting artikel di admin: artikel ditaruh di tanggal WIB waktu tayangnya.
// Fungsi murni, dites di Vitest.

// ISO -> "YYYY-MM-DD" menurut WIB (artikel jam 00.30 WIB tetap di tanggal itu walau UTC-nya kemarin).
export function wibDateKey(iso: string): string {
  return toWibInputValue(iso).slice(0, 10);
}

// ISO -> "09.00" (jam WIB).
export function wibTimeLabel(iso: string): string {
  return toWibInputValue(iso).slice(11, 16).replace(":", ".");
}

// Artikel dikelompokkan per tanggal WIB; urutan masukan (waktu tayang naik) dijaga.
export function articlesByDate<T extends { publishedAt: string }>(items: T[]): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = wibDateKey(item.publishedAt);
    const list = groups.get(key);
    if (list) list.push(item);
    else groups.set(key, [item]);
  }
  return groups;
}
