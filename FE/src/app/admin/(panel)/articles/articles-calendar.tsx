"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { CalendarDaysIcon, ChevronLeftIcon, ChevronRightIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { EmptyState } from "@/components/admin/empty-state";
import { PublicStateLabel } from "@/components/admin/status-dot";
import { Button } from "@/components/admin/ui/button";
import { Skeleton } from "@/components/admin/ui/skeleton";
import { apiFetch } from "@/lib/api/client";
import type { ArticleCalendarItem } from "@/lib/api/types";
import { articlesByDate, wibDateKey, wibTimeLabel } from "@/lib/article-calendar";
import { monthCells, monthLabel, shiftMonth, weeksOf } from "@/lib/calendar-plan";
import { monthParam } from "@/lib/format";
import { cn } from "@/lib/utils";
import { articleKeys } from "./article-keys";

const WEEKDAYS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
// Judul yang muat di sel tanggal (desktop); sisanya "+N lainnya".
const TITLES_PER_CELL = 2;

const dayLabel = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

// Kalender jadwal posting: artikel tayang & terjadwal per tanggal WIB, plus agenda bulan itu.
// Klik tanggal untuk menyaring agenda ke hari itu; klik lagi untuk kembali ke semua.
export function ArticlesCalendar() {
  const today = wibDateKey(new Date().toISOString());
  const [month, setMonth] = useState(() => monthParam(new Date()));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const query = useQuery({
    queryKey: articleKeys.calendar(month),
    queryFn: async () => (await apiFetch<ArticleCalendarItem[]>(`/admin/articles/calendar?month=${month}`)).data,
    placeholderData: keepPreviousData,
  });

  const items = useMemo(() => query.data ?? [], [query.data]);
  const byDate = useMemo(() => articlesByDate(items), [items]);
  const weeks = useMemo(() => weeksOf(monthCells(month)), [month]);
  const agenda = selectedDate ? (byDate.get(selectedDate) ?? []) : items;

  const goTo = (next: string) => {
    setMonth(next);
    setSelectedDate(null);
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <section aria-labelledby="article-calendar-title" className="min-w-0">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 id="article-calendar-title" className="text-lg font-semibold capitalize text-fg-strong">
            {monthLabel(month)}
            <span className="ml-2 font-mono text-xs font-normal uppercase text-fg-muted">WIB</span>
          </h2>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => goTo(monthParam(new Date()))}>
              Hari ini
            </Button>
            <Button variant="outline" size="icon-sm" aria-label="Bulan sebelumnya" onClick={() => goTo(shiftMonth(month, -1))}>
              <ChevronLeftIcon aria-hidden />
            </Button>
            <Button variant="outline" size="icon-sm" aria-label="Bulan berikutnya" onClick={() => goTo(shiftMonth(month, 1))}>
              <ChevronRightIcon aria-hidden />
            </Button>
          </div>
        </div>

        {query.isError ? (
          <div className="flex items-center justify-between gap-4 rounded-md border border-border px-4 py-3">
            <p className="text-small text-status-error">Kalender tidak dapat dimuat.</p>
            <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
              Coba lagi
            </Button>
          </div>
        ) : (
          <table className="w-full table-fixed border-collapse" aria-busy={query.isFetching}>
            <thead>
              <tr>
                {WEEKDAYS.map((day) => (
                  <th key={day} scope="col" className="pb-2 font-mono text-xs font-medium uppercase text-fg-muted">
                    {day}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weeks.map((week) => (
                <tr key={week[0]?.date}>
                  {week.map((cell) => {
                    const dayItems = cell.inMonth ? (byDate.get(cell.date) ?? []) : [];
                    const selected = selectedDate === cell.date;
                    return (
                      <td key={cell.date} className="h-20 border border-border p-0 align-top md:h-28">
                        {cell.inMonth ? (
                          <button
                            type="button"
                            aria-pressed={selected}
                            aria-label={`${dayLabel(cell.date)}, ${dayItems.length} artikel`}
                            onClick={() => setSelectedDate(selected ? null : cell.date)}
                            className={cn(
                              "flex h-full w-full flex-col items-stretch gap-1 p-1.5 text-left outline-none hover:bg-bg-subtle focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                              selected && "bg-bg-subtle ring-2 ring-fg-strong ring-inset",
                            )}
                          >
                            <span className="flex items-center justify-between">
                              <span
                                className={cn(
                                  "font-mono text-xs",
                                  cell.date === today
                                    ? "rounded-sm bg-fg-strong px-1 text-bg"
                                    : "text-fg-muted",
                                )}
                              >
                                {cell.day}
                              </span>
                              {dayItems.length > 0 ? (
                                <span className="rounded-full border border-border-strong px-1.5 font-mono text-[10px] text-fg-strong">
                                  {dayItems.length}
                                </span>
                              ) : null}
                            </span>
                            {query.isPending ? (
                              <Skeleton className="hidden h-3 w-3/4 md:block" />
                            ) : (
                              <span className="hidden min-w-0 flex-col gap-0.5 md:flex">
                                {dayItems.slice(0, TITLES_PER_CELL).map((item) => (
                                  <span
                                    key={item.id}
                                    className={cn(
                                      "truncate rounded-sm px-1 text-[11px] leading-4",
                                      item.publicState === "SCHEDULED"
                                        ? "border border-dashed border-border-strong text-fg"
                                        : "bg-bg-muted text-fg-strong",
                                    )}
                                  >
                                    {item.title}
                                  </span>
                                ))}
                                {dayItems.length > TITLES_PER_CELL ? (
                                  <span className="px-1 text-[11px] text-fg-muted">
                                    +{dayItems.length - TITLES_PER_CELL} lainnya
                                  </span>
                                ) : null}
                              </span>
                            )}
                          </button>
                        ) : (
                          <span className="block h-full bg-bg-subtle/50" aria-hidden />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="mt-3 flex flex-wrap gap-4 text-xs text-fg-muted">
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="inline-block h-3 w-5 rounded-sm bg-bg-muted" /> Tayang
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="inline-block h-3 w-5 rounded-sm border border-dashed border-border-strong" />{" "}
            Terjadwal
          </span>
        </p>
      </section>

      <section aria-labelledby="article-agenda-title" className="min-w-0 xl:border-l xl:border-border xl:pl-6">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 id="article-agenda-title" className="font-mono text-label uppercase text-fg-muted">
            {selectedDate ? dayLabel(selectedDate) : "Agenda bulan ini"}
          </h2>
          <span className="font-mono text-xs text-fg-muted">{agenda.length}</span>
        </div>
        {selectedDate ? (
          <Button variant="ghost" size="sm" className="mb-2 -ml-2" onClick={() => setSelectedDate(null)}>
            Tampilkan semua bulan ini
          </Button>
        ) : null}
        {query.isPending ? (
          <div className="space-y-3" role="status" aria-label="Memuat agenda">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-14 w-full" />
            ))}
          </div>
        ) : agenda.length === 0 ? (
          <EmptyState
            icon={CalendarDaysIcon}
            title={selectedDate ? "Tidak ada artikel di tanggal ini" : "Belum ada artikel di bulan ini"}
            description="Jadwalkan artikel dari form artikel: pilih Jadwalkan lalu isi waktu tayang."
            action={
              <Button variant="outline" asChild>
                <Link href="/admin/articles/new">
                  <PlusIcon aria-hidden />
                  Tulis artikel
                </Link>
              </Button>
            }
          />
        ) : (
          <ol className="divide-y divide-border border-y border-border">
            {agenda.map((item) => (
              <li key={item.id} className="border-l-2 border-fg-strong py-3 pl-3">
                <p className="font-mono text-xs uppercase text-fg-muted">
                  {selectedDate ? null : `${dayLabel(wibDateKey(item.publishedAt))} · `}
                  {wibTimeLabel(item.publishedAt)} WIB
                </p>
                <Link
                  href={`/admin/articles/${item.id}`}
                  className="mt-1 block font-medium text-fg-strong underline-offset-4 hover:underline"
                >
                  {item.title}
                </Link>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <PublicStateLabel state={item.publicState} />
                  {item.category ? <span className="text-xs text-fg-muted">{item.category.name}</span> : null}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
