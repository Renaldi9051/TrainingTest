// Perapian judul kembar hasil seed catalog-rest (11 Nov 2026). Versi pertama seed itu mencocokkan judul
// dengan normalizeTitle, sehingga judul yang hanya beda penulisan ("&" vs "AND", urutan kata) ikut masuk.
// Sekarang seed memakai titleKey; skrip ini merapikan database yang terlanjur berisi kembar.
// Aturan per kelompok (titleKey sama, pelatihan aktif):
// - Dipertahankan: pelatihan yang tidak berasal dari seed catalog-rest; kalau semuanya dari seed, yang
//   dibuat paling awal.
// - Ke Sampah (bisa dipulihkan): pelatihan dari seed catalog-rest yang belum pernah diubah admin (semua
//   entri audit sesudah seed punya penanda seed, atau hanya mengisi sampul/galeri).
// - Kelompok tanpa baris seed yang aman dihapus hanya dilaporkan.
import { AuditAction } from "../src/services/audit";
import { titleKey } from "./seed-catalog-rest";

export type DedupeRow = {
  id: string;
  slug: string;
  title: string;
  createdAt: Date;
  audits: { action: string; diff: unknown }[];
};
export type DedupeGroup = { key: string; keep: DedupeRow; trash: DedupeRow[]; untouched: DedupeRow[] };

const SEED_SOURCE = "catalog-rest";
const PHOTO_ONLY_KEYS = new Set(["coverId", "imageIds"]);

const sourceOf = (diff: unknown): string | null =>
  diff !== null && typeof diff === "object" && "source" in diff && typeof diff.source === "string" ? diff.source : null;

const photoOnly = (audit: DedupeRow["audits"][number]) =>
  audit.action === AuditAction.UPDATE &&
  audit.diff !== null &&
  typeof audit.diff === "object" &&
  Object.keys(audit.diff).every((key) => PHOTO_ONLY_KEYS.has(key));

// audits urut lama -> baru. Dari seed catalog-rest (dibuat/dipulihkan) dan sesudahnya tidak ada suntingan
// admin: setiap entri berikutnya berasal dari seed (punya penanda source) atau hanya foto.
export function fromSeedUntouched(audits: DedupeRow["audits"]): boolean {
  const first = audits.findIndex((audit) => sourceOf(audit.diff) === SEED_SOURCE);
  if (first === -1) return false;
  return audits.slice(first + 1).every((audit) => sourceOf(audit.diff) !== null || photoOnly(audit));
}

export function planDedupe(rows: DedupeRow[]): DedupeGroup[] {
  const groups = new Map<string, DedupeRow[]>();
  for (const row of rows) {
    const key = titleKey(row.title);
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  const result: DedupeGroup[] = [];
  for (const [key, items] of groups) {
    if (items.length < 2) continue;
    const ordered = [...items].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.slug.localeCompare(b.slug));
    const removable = new Set(ordered.filter((row) => fromSeedUntouched(row.audits)).map((row) => row.id));
    const keep = ordered.find((row) => !removable.has(row.id)) ?? ordered[0];
    const others = ordered.filter((row) => row.id !== keep.id);
    result.push({
      key,
      keep,
      trash: others.filter((row) => removable.has(row.id)),
      untouched: others.filter((row) => !removable.has(row.id)),
    });
  }
  return result.sort((a, b) => a.key.localeCompare(b.key));
}
