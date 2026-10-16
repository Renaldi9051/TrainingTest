import { displayTitle } from "@/lib/display-title";
import type { PublicSearchGroup, PublicSearchItem, PublicSearchResult } from "@/lib/api/types";
import type { PaletteGroup, PaletteItem } from "@/lib/command-palette";
import { formatNumber } from "@/lib/format";

// Palette search publik (DESIGN.md 7): hasil GET /api/public/search dikelompokkan Pelatihan, Kategori,
// Layanan, plus tautan ke hasil lengkap di katalog. Fungsi murni, dites di Vitest.

export const PUBLIC_SEARCH_MIN = 2;

const GROUP_LABELS: Record<PublicSearchGroup, string> = {
  trainings: "Pelatihan",
  categories: "Kategori",
  services: "Layanan",
};

export function publicSearchHref(group: PublicSearchGroup, slug: string): string {
  const path = encodeURIComponent(slug);
  switch (group) {
    case "trainings":
      return `/pelatihan/${path}`;
    case "categories":
      return `/pelatihan/kategori/${path}`;
    case "services":
      return `/layanan/${path}`;
  }
}

export function catalogSearchHref(query: string): string {
  return `/pelatihan?q=${encodeURIComponent(query.trim())}`;
}

function toItem(group: PublicSearchGroup, item: PublicSearchItem): PaletteItem {
  return {
    key: `${group}:${item.slug}`,
    href: publicSearchHref(group, item.slug),
    title: group === "trainings" ? displayTitle(item.title) : item.title,
    meta: group === "categories" && item.trainingCount !== undefined ? `${formatNumber(item.trainingCount)} pelatihan` : item.meta,
  };
}

// result null = belum ada hasil untuk kata kunci ini (sedang memuat): hanya tautan katalog.
export function buildPublicPaletteGroups(query: string, result: PublicSearchResult | null): PaletteGroup[] {
  const q = query.trim();
  if (q.length < PUBLIC_SEARCH_MIN) return [];
  const groups: PaletteGroup[] = (result?.groups ?? []).map((group) => ({
    id: group.group,
    label: GROUP_LABELS[group.group],
    items: group.items.map((item) => toItem(group.group, item)),
  }));
  // Memuat: hasil sebelumnya tidak ditampilkan. Tanpa hasil: pesan "tidak ada hasil" dari palette.
  if (result === null || groups.length === 0) return groups;
  return [
    ...groups,
    {
      id: "catalog",
      label: "Katalog",
      items: [{ key: "catalog:all", href: catalogSearchHref(q), title: `Lihat semua hasil untuk "${q}"`, meta: "Cari di katalog pelatihan" }],
    },
  ];
}
