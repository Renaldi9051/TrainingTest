import "server-only";
import { adminServerFetch } from "./server";
import type { ApiSuccess, HomePreview, PublicPage, PublicServiceDetail, PublicTrainingDetail } from "./types";

// Pratinjau draft (draft mode, sesi admin): tidak di-cache, membawa cookie sesi admin ke BE.
// null = sesi tidak valid atau konten tidak ada; halaman lalu memakai data publik biasa.
export async function getTrainingPreview(slug: string): Promise<PublicTrainingDetail | null> {
  const response = await adminServerFetch(`/admin/trainings/preview/${encodeURIComponent(slug)}`);
  if (!response.ok) return null;
  return ((await response.json()) as ApiSuccess<PublicTrainingDetail>).data;
}

async function previewJson<T>(path: string): Promise<T | null> {
  const response = await adminServerFetch(path);
  if (!response.ok) return null;
  return ((await response.json()) as ApiSuccess<T>).data;
}

export function getPagePreview(slug: string): Promise<PublicPage | null> {
  return previewJson<PublicPage>(`/admin/pages/preview/${encodeURIComponent(slug)}`);
}

export function getServicePreview(slug: string): Promise<PublicServiceDetail | null> {
  return previewJson<PublicServiceDetail>(`/admin/services/preview/${encodeURIComponent(slug)}`);
}

// Semua section (termasuk tersembunyi & kosong) dengan flag visible/empty.
export function getHomePreview(): Promise<HomePreview | null> {
  return previewJson<HomePreview>("/admin/home-sections/preview");
}
