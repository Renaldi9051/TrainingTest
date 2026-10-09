import "server-only";
import { adminServerFetch } from "./server";
import type { ApiSuccess, PublicTrainingDetail } from "./types";

// Pratinjau draft (draft mode, sesi admin): tidak di-cache, membawa cookie sesi admin ke BE.
// null = sesi tidak valid atau konten tidak ada; halaman lalu memakai data publik biasa.
export async function getTrainingPreview(slug: string): Promise<PublicTrainingDetail | null> {
  const response = await adminServerFetch(`/admin/trainings/preview/${encodeURIComponent(slug)}`);
  if (!response.ok) return null;
  return ((await response.json()) as ApiSuccess<PublicTrainingDetail>).data;
}
