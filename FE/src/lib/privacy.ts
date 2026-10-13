import { getPageRefs } from "@/lib/api/public";

// Halaman Kebijakan Privasi (seed: /kebijakan-privasi). Teks persetujuan form inquiry menautkannya
// kalau halaman itu tayang; kalau tidak ada, teks tampil tanpa link.
export const PRIVACY_SLUG = "kebijakan-privasi";

export async function privacyPolicyHref(): Promise<string | null> {
  const refs = await getPageRefs();
  return refs.some((ref) => ref.slug === PRIVACY_SLUG) ? `/${PRIVACY_SLUG}` : null;
}
