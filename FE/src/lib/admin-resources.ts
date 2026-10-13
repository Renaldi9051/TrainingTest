import { apiFetch } from "@/lib/api/client";
import type { CategoryOption, OptionItem } from "@/lib/api/types";

// Resource admin yang memakai pola list + options + reorder + restore yang sama (BE 3.2a).
export type AdminResource =
  | "services"
  | "clients"
  | "testimonials"
  | "portfolio"
  | "marketing"
  | "media-partners"
  | "pages"
  | "inquiries";

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

// Sumber pilihan untuk OptionMultiPicker: kontrak sama dengan GET /api/admin/{resource}/options
// (q, limit, ids terpilih selalu ikut).
export type OptionSourceParams = { q?: string; limit: number; ids: string[] };
export type OptionSource = {
  key: readonly unknown[];
  load: (params: OptionSourceParams) => Promise<OptionItem[]>;
};

export function resourceOptionSource(resource: AdminResource | "trainings"): OptionSource {
  return {
    key: ["admin", resource, "options"],
    load: async ({ q, limit, ids }) => {
      const search = new URLSearchParams({ limit: String(limit) });
      if (q) search.set("q", q);
      if (ids.length) search.set("ids", ids.join(","));
      return (await apiFetch<OptionItem[]>(`/admin/${resource}/options?${search}`)).data;
    },
  };
}

// Kategori: endpoint options mengembalikan semua kategori aktif (jumlahnya kecil), jadi pencarian
// dan limit dilakukan di sini.
export const categoryOptionSource: OptionSource = {
  key: ["admin", "categories", "options"],
  load: async ({ q, limit, ids }) => {
    const all = (await apiFetch<CategoryOption[]>("/admin/categories/options")).data;
    const needle = q?.toLowerCase();
    const matches = all.filter((item) => !needle || item.name.toLowerCase().includes(needle)).slice(0, limit);
    const selected = all.filter((item) => ids.includes(item.id) && !matches.includes(item));
    return [...matches, ...selected].map((item) => ({ id: item.id, label: item.name, sublabel: item.slug, imageUrl: null }));
  },
};
