import { getEnv } from "@/lib/env";

// Konvensi tag cache FE (lihat AGENTS.md). Setiap mutasi konten publik memanggil tag yang relevan,
// termasuk tag slug lama kalau slug berubah.
export const RevalidateTag = {
  MEDIA: "media",
  SETTINGS: "settings",
  NAV: "nav",
  CATEGORIES: "categories",
  TRAININGS: "trainings",
  SCHEDULES: "schedules",
  category: (slug: string) => `category:${slug}`,
  training: (slug: string) => `training:${slug}`,
} as const;

// Gabungkan tag tanpa duplikat; nilai kosong dilewati (mis. slug lama yang sama dengan slug baru).
export function tags(...values: (string | null | undefined | false)[]): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

// Batas jumlah tag per request ke endpoint revalidate FE (FE/src/app/api/revalidate/route.ts).
const MAX_TAGS_PER_REQUEST = 50;

async function postTags(chunk: string[]): Promise<boolean> {
  const { FE_REVALIDATE_URL, REVALIDATE_SECRET } = getEnv();
  try {
    const response = await fetch(FE_REVALIDATE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-revalidate-secret": REVALIDATE_SECRET },
      body: JSON.stringify({ tags: chunk }),
      signal: AbortSignal.timeout(3_000),
    });
    if (!response.ok) {
      console.warn(`Revalidate FE gagal (HTTP ${response.status}) untuk tag: ${chunk.join(", ")}`);
      return false;
    }
    return true;
  } catch (error) {
    console.warn(`Revalidate FE tidak dapat dihubungi untuk tag: ${chunk.join(", ")}`, error);
    return false;
  }
}

// Minta FE membuang cache halaman bertag ini. Gagal revalidate tidak menggagalkan mutasi:
// data sudah tersimpan, jadi cukup dicatat di log. Mengembalikan false kalau ada batch yang gagal
// (dipakai scheduler publish untuk mencoba lagi di putaran berikutnya).
export async function revalidateTags(values: string[]): Promise<boolean> {
  const unique = [...new Set(values)];
  if (unique.length === 0) return true;
  let ok = true;
  for (let index = 0; index < unique.length; index += MAX_TAGS_PER_REQUEST) {
    ok = (await postTags(unique.slice(index, index + MAX_TAGS_PER_REQUEST))) && ok;
  }
  return ok;
}
