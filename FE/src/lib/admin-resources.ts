import { apiFetch } from "@/lib/api/client";
import type { OptionItem } from "@/lib/api/types";

// Resource admin yang memakai pola list + options + reorder + restore yang sama (BE 3.2a).
export type AdminResource =
  | "services"
  | "clients"
  | "testimonials"
  | "portfolio"
  | "marketing"
  | "media-partners"
  | "pages";

export function resourceKeys(resource: AdminResource) {
  return {
    all: ["admin", resource] as const,
    list: (params: object) => ["admin", resource, "list", params] as const,
    detail: (id: string) => ["admin", resource, "detail", id] as const,
    // Semua baris aktif untuk panel urutkan.
    reorder: ["admin", resource, "options", "reorder"] as const,
  };
}

// Batas sama dengan BE (OPTIONS_MAX_LIMIT): panel urutkan memuat semua baris aktif.
const REORDER_LIMIT = 500;

export async function loadReorderOptions(resource: AdminResource): Promise<OptionItem[]> {
  return (await apiFetch<OptionItem[]>(`/admin/${resource}/options?limit=${REORDER_LIMIT}`)).data;
}
