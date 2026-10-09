import Link from "next/link";
import type { ScheduleStatus, TrainingMethod } from "@/lib/api/types";
import { formatDateRange, formatRupiah } from "@/lib/format";
import { METHOD_LABELS } from "@/lib/labels";

export type ScheduleRow = {
  id: string;
  startDate: string;
  endDate: string;
  city: string | null;
  venue: string | null;
  method: TrainingMethod;
  price: number | null;
  status: ScheduleStatus;
  training?: { slug: string; title: string };
};

// Status ditulis teks mono tanpa warna (DESIGN 7).
const STATUS_TEXT: Record<ScheduleStatus, string> = { OPEN: "DIBUKA", FULL: "PENUH", COMPLETED: "SELESAI" };

const PRICE_HIDDEN = "Hubungi marketing";

// Tabel jadwal DESIGN 7: tanpa garis vertikal, header mono, baris hover --bg-subtle.
// Di layar kecil tiap baris jadi blok bertumpuk (tanpa scroll horizontal).
// showPrice false (atau harga kosong): tampil "Hubungi marketing".
export function ScheduleTable({
  rows,
  caption,
  showTraining = false,
}: {
  rows: ScheduleRow[];
  caption: string;
  showTraining?: boolean;
}) {
  return (
    <table className="w-full border-collapse text-left">
      <caption className="sr-only">{caption}</caption>
      <thead className="hidden md:table-header-group">
        <tr className="border-b border-border-strong">
          <th scope="col" className="py-3 pr-4 font-mono text-label font-medium uppercase tracking-[0.08em] text-fg-muted">
            Tanggal
          </th>
          {showTraining ? (
            <th scope="col" className="py-3 pr-4 font-mono text-label font-medium uppercase tracking-[0.08em] text-fg-muted">
              Pelatihan
            </th>
          ) : null}
          <th scope="col" className="py-3 pr-4 font-mono text-label font-medium uppercase tracking-[0.08em] text-fg-muted">
            Lokasi
          </th>
          <th scope="col" className="py-3 pr-4 font-mono text-label font-medium uppercase tracking-[0.08em] text-fg-muted">
            Metode
          </th>
          <th scope="col" className="py-3 pr-4 font-mono text-label font-medium uppercase tracking-[0.08em] text-fg-muted">
            Investasi
          </th>
          <th scope="col" className="py-3 font-mono text-label font-medium uppercase tracking-[0.08em] text-fg-muted">
            Status
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            key={row.id}
            className="grid grid-cols-2 gap-x-4 gap-y-1 border-b border-border py-4 transition-colors duration-150 hover:bg-bg-subtle md:table-row md:py-0"
          >
            <td className="col-span-2 font-medium text-fg-strong md:py-4 md:pr-4 md:whitespace-nowrap">
              {formatDateRange(row.startDate, row.endDate)}
            </td>
            {showTraining && row.training ? (
              <td className="col-span-2 md:py-4 md:pr-4">
                <Link
                  href={`/pelatihan/${row.training.slug}`}
                  className="underline-offset-4 outline-none hover:underline focus-visible:underline"
                >
                  {row.training.title}
                </Link>
              </td>
            ) : null}
            <td className="col-span-2 text-small text-fg md:py-4 md:pr-4">
              {[row.city, row.venue].filter(Boolean).join(" · ") || "-"}
            </td>
            <td className="text-small text-fg-muted md:py-4 md:pr-4">{METHOD_LABELS[row.method]}</td>
            <td className="text-small md:py-4 md:pr-4 md:whitespace-nowrap">
              {row.price === null ? <span className="text-fg-muted">{PRICE_HIDDEN}</span> : formatRupiah(row.price)}
            </td>
            <td className="col-span-2 font-mono text-label uppercase tracking-[0.08em] text-fg-strong md:py-4">
              <span className="sr-only md:hidden">Status: </span>
              {STATUS_TEXT[row.status]}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function ScheduleTableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Memuat jadwal" className="border-t border-border-strong">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex gap-6 border-b border-border py-5">
          <div className="h-4 w-32 bg-bg-muted" />
          <div className="h-4 flex-1 bg-bg-muted" />
          <div className="hidden h-4 w-24 bg-bg-muted md:block" />
        </div>
      ))}
      <span className="sr-only">Memuat jadwal...</span>
    </div>
  );
}
