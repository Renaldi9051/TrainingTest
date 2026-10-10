// Ringkasan item terpilih di dialog konfirmasi bulk action: maksimal 3 judul pertama,
// sisanya ditulis "dan N lainnya", supaya admin tahu persis apa yang akan diubah.
const PREVIEW_LIMIT = 3;

type BulkSelectionSummaryProps = {
  items: { id: string; title: string }[];
  // Jumlah total terpilih (bisa lebih besar dari items kalau sebagian baris tidak lagi dimuat).
  total: number;
  label: string;
};

export function BulkSelectionSummary({ items, total, label }: BulkSelectionSummaryProps) {
  const shown = items.slice(0, PREVIEW_LIMIT);
  const rest = total - shown.length;
  return (
    <div className="rounded-md border border-border px-3 py-2">
      <p className="font-mono text-label font-medium uppercase text-fg-muted">{label}</p>
      <ul className="mt-1.5 space-y-1 text-small text-fg" aria-label={label}>
        {shown.map((item) => (
          <li key={item.id} className="truncate">
            {item.title}
          </li>
        ))}
      </ul>
      {rest > 0 ? <p className="mt-1 text-small text-fg-muted">dan {rest} lainnya</p> : null}
    </div>
  );
}
