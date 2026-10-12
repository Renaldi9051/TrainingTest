import { z } from "zod";

// Konvensi referensi media di dalam JSON konten (HomeSection.content, Page.blocks):
// selalu berbentuk objek `{ mediaId }`, dan key `mediaId` TIDAK boleh dipakai untuk hal lain di
// JSON tersebut. Dengan begitu "media dipakai di mana" dan hapus aman cukup mencari key ini di
// semua tingkat (collectMediaRefs di aplikasi, `$.**.mediaId` di Postgres), tanpa perlu tahu
// bentuk tiap type. Test validator memastikan ekstraktor per type sama dengan pencarian generik.

export const MEDIA_REF_KEY = "mediaId";

export type MediaKind = "image" | "pdf";

export const mediaRefObjectSchema = z.object(
  { mediaId: z.uuid({ error: "Media tidak valid." }) },
  { error: "Media tidak valid." },
);
export type MediaRef = z.infer<typeof mediaRefObjectSchema>;

// Referensi media + path field-nya (format path error form, mis. "image" atau "3.file").
export type MediaRefHit = { path: string; mediaId: string };
// requireAlt: gambar konten yang tampil di publik wajib punya alt (lihat assertMediaRefs).
export type TypedMediaRef = MediaRefHit & { kind: MediaKind; requireAlt: boolean };

export function collectMediaRefs(value: unknown, prefix = ""): MediaRefHit[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => collectMediaRefs(item, joinPath(prefix, String(index))));
  }
  if (typeof value !== "object" || value === null) return [];
  const record = value as Record<string, unknown>;
  const hits: MediaRefHit[] = [];
  const own = record[MEDIA_REF_KEY];
  if (typeof own === "string") hits.push({ path: prefix, mediaId: own });
  for (const [key, child] of Object.entries(record)) {
    if (key === MEDIA_REF_KEY) continue;
    hits.push(...collectMediaRefs(child, joinPath(prefix, key)));
  }
  return hits;
}

function joinPath(prefix: string, key: string): string {
  return prefix ? `${prefix}.${key}` : key;
}
