// State filter halaman /artikel di URL (?kategori=<slug>&hal=<n>). Fungsi murni, dites di Vitest.

export type ArticleListState = { kategori: string | null; hal: number };

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// Nilai yang tidak dikenal diabaikan (URL bisa diketik/dibagikan sembarang), sama dengan BE.
export function parseArticleListState(params: Record<string, string | string[] | undefined>): ArticleListState {
  const kategori = first(params.kategori)?.trim().toLowerCase() ?? "";
  const hal = Number(first(params.hal));
  return {
    kategori: SLUG_PATTERN.test(kategori) && kategori.length <= 120 ? kategori : null,
    hal: Number.isInteger(hal) && hal >= 1 && hal <= 1000 ? hal : 1,
  };
}

// Ganti kategori = kembali ke halaman 1.
export function articleListHref(state: ArticleListState, change: Partial<ArticleListState>): string {
  const next: ArticleListState = {
    kategori: change.kategori !== undefined ? change.kategori : state.kategori,
    hal: change.hal ?? (change.kategori !== undefined ? 1 : state.hal),
  };
  const search = new URLSearchParams();
  if (next.kategori) search.set("kategori", next.kategori);
  if (next.hal > 1) search.set("hal", String(next.hal));
  const query = search.toString();
  return query ? `/artikel?${query}` : "/artikel";
}
