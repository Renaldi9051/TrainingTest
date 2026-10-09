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

// Minta FE membuang cache halaman bertag ini. Gagal revalidate tidak menggagalkan mutasi:
// data sudah tersimpan, jadi cukup dicatat di log.
export async function revalidateTags(tags: string[]): Promise<void> {
  if (tags.length === 0) return;
  const { FE_REVALIDATE_URL, REVALIDATE_SECRET } = getEnv();
  try {
    const response = await fetch(FE_REVALIDATE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-revalidate-secret": REVALIDATE_SECRET },
      body: JSON.stringify({ tags }),
      signal: AbortSignal.timeout(3_000),
    });
    if (!response.ok) {
      console.warn(`Revalidate FE gagal (HTTP ${response.status}) untuk tag: ${tags.join(", ")}`);
    }
  } catch (error) {
    console.warn(`Revalidate FE tidak dapat dihubungi untuk tag: ${tags.join(", ")}`, error);
  }
}
