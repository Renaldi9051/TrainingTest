import type { CatalogParams } from "@/lib/api/public";

// State filter katalog di URL: /pelatihan?q=&kategori=a,b&metode=&tipe=&urut=&hal=
// Nilai yang tidak dikenal dibuang (URL bisa diketik/dibagikan sembarang).

export const METHOD_PARAMS = ["online", "offline", "hybrid"] as const;
export const TYPE_PARAMS = ["public", "in-house"] as const;
export const SORT_PARAMS = ["relevan", "terbaru", "az"] as const;

export type CatalogState = {
  q: string;
  kategori: string[];
  metode: (typeof METHOD_PARAMS)[number] | null;
  tipe: (typeof TYPE_PARAMS)[number] | null;
  urut: (typeof SORT_PARAMS)[number] | null;
  hal: number;
};

type RawParams = Record<string, string | string[] | undefined>;

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

function oneOf<T extends string>(value: string, options: readonly T[]): T | null {
  return (options as readonly string[]).includes(value) ? (value as T) : null;
}

export function parseCatalogState(raw: RawParams): CatalogState {
  const page = Number.parseInt(first(raw.hal), 10);
  return {
    q: first(raw.q).slice(0, 100),
    kategori: [
      ...new Set(
        first(raw.kategori)
          .split(",")
          .map((slug) => slug.trim())
          .filter((slug) => SLUG.test(slug)),
      ),
    ].slice(0, 20),
    metode: oneOf(first(raw.metode).toLowerCase(), METHOD_PARAMS),
    tipe: oneOf(first(raw.tipe).toLowerCase(), TYPE_PARAMS),
    urut: oneOf(first(raw.urut), SORT_PARAMS),
    hal: Number.isFinite(page) && page > 1 ? Math.min(page, 1000) : 1,
  };
}

export function toCatalogParams(state: CatalogState, per?: number): CatalogParams {
  return {
    q: state.q || undefined,
    kategori: state.kategori,
    metode: state.metode ?? undefined,
    tipe: state.tipe ?? undefined,
    urut: state.urut ?? undefined,
    hal: state.hal,
    per,
  };
}

// URL katalog dengan urutan parameter tetap. Mengubah filter selalu kembali ke halaman 1.
export function catalogHref(state: CatalogState, change: Partial<CatalogState> = {}): string {
  const next: CatalogState = { ...state, hal: 1, ...change };
  const params = new URLSearchParams();
  if (next.q) params.set("q", next.q);
  if (next.kategori.length > 0) params.set("kategori", next.kategori.join(","));
  if (next.metode) params.set("metode", next.metode);
  if (next.tipe) params.set("tipe", next.tipe);
  if (next.urut) params.set("urut", next.urut);
  if (next.hal > 1) params.set("hal", String(next.hal));
  const query = params.toString();
  return query ? `/pelatihan?${query}` : "/pelatihan";
}

export function toggleCategory(state: CatalogState, slug: string): string {
  const kategori = state.kategori.includes(slug)
    ? state.kategori.filter((item) => item !== slug)
    : [...state.kategori, slug];
  return catalogHref(state, { kategori });
}

export function hasFilters(state: CatalogState): boolean {
  return Boolean(state.q || state.kategori.length > 0 || state.metode || state.tipe);
}

// Canonical katalog terfilter: landing kategori kalau filternya hanya satu kategori,
// selain itu /pelatihan (hasil filter/search tidak diindeks sebagai halaman terpisah).
export function catalogCanonical(state: CatalogState): string {
  if (state.kategori.length === 1 && !state.q && !state.metode && !state.tipe) {
    return `/pelatihan/kategori/${state.kategori[0]}`;
  }
  return "/pelatihan";
}
