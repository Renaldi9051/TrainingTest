// Konfigurasi pilihan data dari section beranda / blok halaman: mode auto (aturan per entitas,
// dibatasi limit) atau manual (id pilihan admin, urutan dijaga). Bukan salinan data.
export type Selection = { mode: "auto" | "manual"; limit: number; ids: string[] };

type SelectionLoader<TRow extends { id: string }, TItem> = {
  // Baris publik untuk id-id ini (id yang dihapus/draft tidak dikembalikan = tersaring).
  byIds: (ids: string[]) => Promise<TRow[]>;
  // Baris publik teratas untuk mode auto, sudah terurut.
  top: (limit: number) => Promise<TRow[]>;
  toItem: (row: TRow) => TItem;
};

// Resolve banyak konfigurasi sekaligus dengan jumlah query tetap, tidak bergantung jumlah section:
// maksimal satu query untuk SEMUA id manual dan satu query auto dengan limit terbesar.
export async function resolveSelections<TRow extends { id: string }, TItem>(
  selections: Selection[],
  loader: SelectionLoader<TRow, TItem>,
): Promise<TItem[][]> {
  if (selections.length === 0) return [];
  const manualIds = [...new Set(selections.flatMap((selection) => (selection.mode === "manual" ? selection.ids : [])))];
  const autoLimit = Math.max(0, ...selections.filter((selection) => selection.mode === "auto").map((s) => s.limit));
  const [manualRows, autoRows] = await Promise.all([
    manualIds.length ? loader.byIds(manualIds) : Promise.resolve([]),
    autoLimit ? loader.top(autoLimit) : Promise.resolve([]),
  ]);
  const byId = new Map(manualRows.map((row) => [row.id, loader.toItem(row)]));
  const auto = autoRows.map(loader.toItem);
  return selections.map((selection) =>
    selection.mode === "manual" ? selection.ids.flatMap((id) => byId.get(id) ?? []) : auto.slice(0, selection.limit),
  );
}
