// State grid kategori /pelatihan di URL: ?q=&page=. Nilai tak dikenal dibuang (URL bisa diketik sembarang).

export type CategoryGridState = { q: string; page: number };

type RawParams = Record<string, string | string[] | undefined>;

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
// Parameter katalog kartu lama (sebelum 5 Nov 2026). Dibuang lewat 308 ke /pelatihan.
const LEGACY_PARAMS = ["metode", "tipe", "sort", "urut", "hal", "per"] as const;

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

function toPage(value: string): number {
  const page = Number.parseInt(value, 10);
  return Number.isFinite(page) && page > 1 ? Math.min(page, 1000) : 1;
}

export function parseGridState(raw: RawParams): CategoryGridState {
  return { q: first(raw.q).replace(/\s+/g, " ").slice(0, 100), page: toPage(first(raw.page)) };
}

// Urutan parameter tetap; halaman 1 tidak ditulis. Mengubah q selalu kembali ke halaman 1 (pemanggil).
export function gridHref(state: CategoryGridState): string {
  const params = new URLSearchParams();
  if (state.q) params.set("q", state.q);
  if (state.page > 1) params.set("page", String(state.page));
  const query = params.toString();
  return query ? `/pelatihan?${query}` : "/pelatihan";
}

// Canonical per halaman. Hasil pencarian tidak diindeks terpisah (canonical /pelatihan).
export function gridCanonical(state: CategoryGridState): string {
  return state.q ? "/pelatihan" : gridHref({ q: "", page: state.page });
}

// Slug kategori pertama dari ?kategori=a,b (URL lama). null kalau kosong/tidak valid.
export function firstCategorySlug(value: string | null): string | null {
  const slug = value?.split(",").map((item) => item.trim()).find((item) => SLUG.test(item));
  return slug ?? null;
}

// URL katalog lama dengan ?metode=/?tipe=/?sort=/?urut=/?hal=: tujuan 308 ke /pelatihan dengan q dan
// page dipertahankan (hal lama dipakai sebagai page kalau page tidak ada). null = tidak perlu redirect.
export function legacyCatalogTarget(params: URLSearchParams): string | null {
  if (!LEGACY_PARAMS.some((key) => params.has(key))) return null;
  const q = params.get("q")?.replace(/\s+/g, " ").trim().slice(0, 100) ?? "";
  const page = toPage(params.get("page") ?? params.get("hal") ?? "");
  return gridHref({ q, page });
}
