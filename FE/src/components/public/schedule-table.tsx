import Link from "next/link";
import { RevealRows } from "@/components/motion/reveal-rows";
import type { ScheduleStatus, TrainingMethod } from "@/lib/api/types";
import { dateBadgeParts, formatDateRange, formatRupiah } from "@/lib/format";
import { displayTitle } from "@/lib/display-title";
import { METHOD_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";

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
// Palet E: titik status (dekoratif) di samping label teks; DIBUKA --ok, PENUH --fg-muted.
const STATUS_DOT: Record<ScheduleStatus, string> = { OPEN: "bg-ok", FULL: "bg-fg-muted", COMPLETED: "bg-border-strong" };

const PRICE_HIDDEN = "Hubungi marketing";

const TH = "py-4 font-mono text-label font-medium uppercase tracking-[0.08em] text-fg-muted";
// Jarak antar kolom (md+).
const CELL_GAP = "md:pr-6";

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
    // Tabel menyatu dengan latar section (keputusan pemilik 20 Nov 2026, tanpa panel --surface). Di section
    // --bg-subtle (data-tone="subtle") hover baris memakai --bg-muted supaya tetap terlihat.
    <table className="w-full border-collapse text-left">
      <caption className="sr-only">{caption}</caption>
      <thead className="hidden md:table-header-group">
        <tr className="border-b border-border-strong">
          <th scope="col" className={cn(TH, CELL_GAP)}>
            Tanggal
          </th>
          {showTraining ? (
            <th scope="col" className={cn(TH, CELL_GAP)}>
              Pelatihan
            </th>
          ) : null}
          <th scope="col" className={cn(TH, CELL_GAP)}>
            Lokasi
          </th>
          <th scope="col" className={cn(TH, CELL_GAP)}>
            Metode
          </th>
          <th scope="col" className={cn(TH, CELL_GAP)}>
            Investasi
          </th>
          <th scope="col" className={TH}>
            Status
          </th>
        </tr>
      </thead>
      <RevealRows as="tbody" kind="item">
        {rows.map((row) => (
          <tr
            key={row.id}
            className="grid grid-cols-2 gap-x-4 gap-y-1 border-b border-border py-5 transition-[background-color,transform] duration-150 ease-standard hover:bg-bg-subtle in-data-[tone=subtle]:hover:bg-bg-muted motion-safe:hover:translate-x-2 motion-safe:focus-within:translate-x-2 md:table-row md:py-0"
          >
            <td className={cn("col-span-2 font-medium text-fg-strong md:py-5 md:whitespace-nowrap", CELL_GAP)}>
              {bigDate ? <BigDate start={row.startDate} end={row.endDate} /> : formatDateRange(row.startDate, row.endDate)}
            </td>
            {showTraining && row.training ? (
              <td className={cn("col-span-2 md:py-5", CELL_GAP)}>
                <Link
                  href={`/pelatihan/${row.training.slug}`}
                  className="underline-offset-4 outline-none hover:underline focus-visible:underline"
                >
                  {displayTitle(row.training.title)}
                </Link>
              </td>
            ) : null}
            <td className={cn("col-span-2 text-small text-fg md:py-5", CELL_GAP)}>
              {[row.city, row.venue].filter(Boolean).join(" · ") || "-"}
            </td>
            <td className={cn("text-small text-fg-muted md:py-5", CELL_GAP)}>{METHOD_LABELS[row.method]}</td>
            <td className={cn("text-small md:py-5 md:whitespace-nowrap", CELL_GAP)}>
              {row.price === null ? <span className="text-fg-muted">{PRICE_HIDDEN}</span> : formatRupiah(row.price)}
            </td>
            <td className={cn("col-span-2 font-mono text-label uppercase tracking-[0.08em] text-fg-strong md:py-5 md:whitespace-nowrap")}>
              <span className="inline-flex items-center gap-2">
                <span aria-hidden className={cn("size-2 shrink-0 rounded-full", STATUS_DOT[row.status])} />
                <span>
                  <span className="sr-only md:hidden">Status: </span>
                  {STATUS_TEXT[row.status]}
                </span>
              </span>
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
    <span className="flex flex-col items-start gap-2">
      {/* Palet E: kotak tanggal --primary / --on-primary. */}
      <span aria-hidden className="flex w-20 flex-col items-center gap-1 rounded-md bg-primary px-2 py-2.5 text-on-primary">
        <span className="text-[28px] leading-none font-semibold tracking-[-0.03em]">{day}</span>
        <span className="font-mono text-[11px] leading-none font-medium uppercase tracking-[0.08em]">{monthYear}</span>
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
