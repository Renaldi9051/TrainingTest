import { getEnv } from "@/lib/env";

export const RevalidateTag = {
  MEDIA: "media",
} as const;

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
