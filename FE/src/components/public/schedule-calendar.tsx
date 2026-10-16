import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import type { PublicSchedule, ScheduleStatus } from "@/lib/api/types";
import { byStartDate, monthCells, monthLabel, rangeLabel, weeksOf } from "@/lib/calendar-plan";
import { displayTitle } from "@/lib/display-title";
import { METHOD_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";

const WEEKDAYS = [
  { short: "Sen", long: "Senin" },
  { short: "Sel", long: "Selasa" },
  { short: "Rab", long: "Rabu" },
  { short: "Kam", long: "Kamis" },
  { short: "Jum", long: "Jumat" },
  { short: "Sab", long: "Sabtu" },
  { short: "Min", long: "Minggu" },
];

// Status ditulis teks mono tanpa warna (DESIGN 8.8).
const STATUS_TEXT: Record<ScheduleStatus, string> = { OPEN: "DIBUKA", FULL: "PENUH", COMPLETED: "SELESAI" };

function place(schedule: PublicSchedule): string {
  return schedule.city ?? METHOD_LABELS[schedule.method];
}

// Sesi di sel: DIBUKA = blok hitam, PENUH/SELESAI = garis (status juga tertulis, bukan hanya gaya).
function EventLink({ schedule }: { schedule: PublicSchedule }) {
  const open = schedule.status === "OPEN";
  return (
    <Link
      href={`/pelatihan/${schedule.training.slug}`}
      className={cn(
        "block rounded-sm px-2 py-1.5 text-[12px] leading-[1.3] outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1",
        // Palet C: sesi dibuka --primary; penuh/selesai bergaris.
        open ? "bg-primary text-on-primary hover:bg-primary-hover" : "border border-border-strong text-fg-muted hover:text-fg-strong",
      )}
    >
      <span className="line-clamp-2 font-medium">{displayTitle(schedule.training.title)}</span>
      <span className="mt-0.5 block font-mono text-[10px] tracking-[0.04em] uppercase">
        {rangeLabel(schedule.startDate, schedule.endDate)} / {place(schedule)}
        {open ? null : ` / ${STATUS_TEXT[schedule.status]}`}
      </span>
    </Link>
  );
}

// Kalender bulanan (mockup jadwal.html): minggu mulai Senin; sesi multi-hari cukup di tanggal mulai,
// rentangnya ditulis di teks. Desktop: tabel 7 kolom. Layar kecil: agenda per tanggal (7 kolom terlalu
// sempit untuk judul). Tanpa sesi: grid tetap tampil dengan pesan di atasnya.
export function ScheduleCalendar({
  month,
  items,
  prevHref,
  nextHref,
  empty,
}: {
  month: string;
  items: PublicSchedule[];
  prevHref: string;
  nextHref: string;
  empty: ReactNode;
}) {
  const cells = monthCells(month);
  const byDate = byStartDate(items);
  const label = monthLabel(month);
  const days = cells.filter((cell) => cell.inMonth && byDate.has(cell.date));

  return (
    <section aria-labelledby="kalender-title" className="mt-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Link
            href={prevHref}
            scroll={false}
            className="inline-flex size-9 items-center justify-center rounded-md border border-border-strong text-fg outline-none hover:bg-bg-subtle focus-visible:ring-2 focus-visible:ring-focus"
          >
            <ChevronLeftIcon aria-hidden strokeWidth={1.5} className="size-4" />
            <span className="sr-only">Bulan sebelumnya</span>
          </Link>
          <h2 id="kalender-title" className="min-w-[10ch] text-center text-h3 text-fg-strong capitalize">
            {label}
          </h2>
          <Link
            href={nextHref}
            scroll={false}
            className="inline-flex size-9 items-center justify-center rounded-md border border-border-strong text-fg outline-none hover:bg-bg-subtle focus-visible:ring-2 focus-visible:ring-focus"
          >
            <ChevronRightIcon aria-hidden strokeWidth={1.5} className="size-4" />
            <span className="sr-only">Bulan berikutnya</span>
          </Link>
        </div>
        <p className="flex flex-wrap items-center gap-4 text-small text-fg-muted">
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="size-3 rounded-sm bg-primary" />
            Dibuka
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="size-3 rounded-sm border border-border-strong" />
            Penuh atau selesai
          </span>
        </p>
      </div>

      {items.length === 0 ? <div className="mb-4">{empty}</div> : null}

      {/* Tanpa sesi: grid bulan tetap tampil juga di layar kecil (ringkas). */}
      <table className={cn("w-full table-fixed border-collapse", items.length > 0 ? "hidden md:table" : "table")}>
        <caption className="sr-only">Kalender sesi {label}</caption>
        <thead>
          <tr>
            {WEEKDAYS.map((weekday) => (
              <th
                key={weekday.short}
                scope="col"
                abbr={weekday.long}
                className="border-b border-border-strong bg-bg-subtle px-2 py-2 text-left font-mono text-label font-medium uppercase tracking-[0.08em] text-accent-ink"
              >
                {weekday.short}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeksOf(cells).map((week) => (
            <tr key={week[0].date}>
              {week.map((cell) => {
                const events = cell.inMonth ? (byDate.get(cell.date) ?? []) : [];
                return (
                  <td key={cell.date} className={cn("h-12 border border-border p-1.5 align-top md:h-28", !cell.inMonth && "bg-bg-subtle")}>
                    <span className={cn("block px-1 font-mono text-[13px]", cell.inMonth ? "text-fg" : "text-fg-subtle")}>
                      {cell.day}
                      {!cell.inMonth ? <span className="sr-only"> (di luar bulan ini)</span> : null}
                    </span>
                    {events.length > 0 ? (
                      <ul className="mt-1 space-y-1">
                        {events.map((schedule) => (
                          <li key={schedule.id}>
                            <EventLink schedule={schedule} />
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Layar kecil: agenda per tanggal. */}
      {days.length > 0 ? (
        <ol className="border-t border-border md:hidden">
          {days.map((cell) => {
            const date = new Date(`${cell.date}T00:00:00Z`);
            return (
              <li key={cell.date} className="grid grid-cols-[64px_minmax(0,1fr)] gap-3 border-b border-border py-4">
                <span>
                  <span className="block text-h3 leading-none text-fg-strong">{cell.day}</span>
                  <span className="mt-1 block font-mono text-label uppercase tracking-[0.08em] text-fg-muted">
                    {date.toLocaleDateString("id-ID", { weekday: "short", timeZone: "UTC" }).replace(".", "")}
                  </span>
                </span>
                <ul className="space-y-2">
                  {(byDate.get(cell.date) ?? []).map((schedule) => (
                    <li key={schedule.id}>
                      <EventLink schedule={schedule} />
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ol>
      ) : null}
    </section>
  );
}
