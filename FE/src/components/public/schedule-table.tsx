import Link from "next/link";
import { RevealRows } from "@/components/motion/reveal-rows";
import type { ScheduleStatus, TrainingMethod } from "@/lib/api/types";
import { dateBadgeParts, formatDateRange, formatRupiah } from "@/lib/format";
import { displayTitle } from "@/lib/display-title";
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

// Tabel jadwal DESIGN 7: tanpa garis vertikal, header mono, baris hover --bg-subtle + geser 8 px.
// Di layar kecil tiap baris jadi blok bertumpuk (tanpa scroll horizontal). Masuk: baris dari kiri,
// per baris saat barisnya masuk viewport (RevealRows).
// showPrice false (atau harga kosong): tampil "Hubungi marketing".
// bigDate: tanggal mulai besar (hari + bulan mono) di kolom kiri, rentang tanggal di bawahnya
// (DESIGN.md 8.8 & 13, beranda).
export function ScheduleTable({
  rows,
  caption,
  showTraining = false,
  bigDate = false,
}: {
  rows: ScheduleRow[];
  caption: string;
  showTraining?: boolean;
  bigDate?: boolean;
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
      <RevealRows as="tbody" kind="item">
        {rows.map((row) => (
          <tr
            key={row.id}
            className="grid grid-cols-2 gap-x-4 gap-y-1 border-b border-border py-4 transition-[background-color,transform] duration-150 ease-standard hover:bg-bg-subtle motion-safe:hover:translate-x-2 motion-safe:focus-within:translate-x-2 md:table-row md:py-0"
          >
            <td className="col-span-2 font-medium text-fg-strong md:py-4 md:pr-4 md:whitespace-nowrap">
              {bigDate ? <BigDate start={row.startDate} end={row.endDate} /> : formatDateRange(row.startDate, row.endDate)}
            </td>
            {showTraining && row.training ? (
              <td className="col-span-2 md:py-4 md:pr-4">
                <Link
                  href={`/pelatihan/${row.training.slug}`}
                  className="underline-offset-4 outline-none hover:underline focus-visible:underline"
                >
                  {displayTitle(row.training.title)}
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
      </RevealRows>
    </table>
  );
}

function BigDate({ start, end }: { start: string; end: string }) {
  const { day, monthYear } = dateBadgeParts(start);
  return (
    <span className="flex flex-col gap-1">
      <span aria-hidden className="text-[32px] leading-none font-semibold tracking-[-0.03em]">
        {day}
      </span>
      <span aria-hidden className="font-mono text-label font-medium uppercase tracking-[0.08em] text-fg-muted">
        {monthYear}
      </span>
      {/* Rentang lengkap tetap dibaca pembaca layar dan tampil kecil. */}
      <span className="text-small font-normal text-fg-muted">{formatDateRange(start, end)}</span>
    </span>
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
