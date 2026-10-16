import Form from "next/form";
import Link from "next/link";
import { connection } from "next/server";
import { ActiveIndicator } from "@/components/motion/active-indicator";
import { ChipLink } from "@/components/public/chip-link";
import { JsonLd } from "@/components/public/json-ld";
import { Pagination } from "@/components/public/pagination";
import { ScheduleCalendar } from "@/components/public/schedule-calendar";
import { ScheduleTable } from "@/components/public/schedule-table";
import { ButtonArrow, buttonVariants } from "@/components/ui/button";
import { getCategories, getSchedules, getSettings, type ScheduleParams } from "@/lib/api/public";
import { shiftMonth } from "@/lib/calendar-plan";
import { displayTitle } from "@/lib/display-title";
import { getPublicEnv } from "@/lib/env";
import { APP_TIME_ZONE, formatNumber, monthParam } from "@/lib/format";
import { scheduleEventJsonLd } from "@/lib/structured-data";
import { cn } from "@/lib/utils";

type RawParams = Record<string, string | string[] | undefined>;
type View = "list" | "kalender";
type ScheduleState = Required<Pick<ScheduleParams, "hal">> & ScheduleParams & { tampilan: View };

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
// Kalender memuat semua sesi sebulan sekaligus (BE maks 100 per permintaan).
const CALENDAR_PER = 100;

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

export function parseScheduleState(raw: RawParams): ScheduleState {
  const bulan = first(raw.bulan);
  const kategori = first(raw.kategori);
  const kota = first(raw.kota).slice(0, 100);
  const hal = Number.parseInt(first(raw.hal), 10);
  return {
    bulan: MONTH.test(bulan) ? bulan : undefined,
    kota: kota || undefined,
    kategori: SLUG.test(kategori) ? kategori : undefined,
    hal: Number.isFinite(hal) && hal > 1 ? Math.min(hal, 1000) : 1,
    tampilan: first(raw.tampilan) === "kalender" ? "kalender" : "list",
  };
}

function scheduleHref(state: ScheduleState, change: Partial<ScheduleState> = {}): string {
  const next = { ...state, hal: 1, ...change };
  const params = new URLSearchParams();
  if (next.bulan) params.set("bulan", next.bulan);
  if (next.kota) params.set("kota", next.kota);
  if (next.kategori) params.set("kategori", next.kategori);
  if (next.tampilan === "kalender") params.set("tampilan", "kalender");
  if (next.hal > 1) params.set("hal", String(next.hal));
  const query = params.toString();
  return query ? `/jadwal?${query}` : "/jadwal";
}

// Pilihan bulan: 2 bulan lalu sampai 12 bulan ke depan (WIB).
function monthOptions(now: Date): { value: string; label: string }[] {
  const [year, month] = new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIME_ZONE, year: "numeric", month: "2-digit" })
    .format(now)
    .split("-")
    .map(Number);
  return Array.from({ length: 15 }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 1 + index - 2, 1));
    return {
      value: date.toISOString().slice(0, 7),
      label: date.toLocaleDateString("id-ID", { month: "long", year: "numeric", timeZone: "UTC" }),
    };
  });
}

const selectClass =
  "h-10 w-full rounded-md border border-border-strong bg-bg px-3 text-small text-fg outline-none focus-visible:border-fg-strong focus-visible:ring-2 focus-visible:ring-fg-strong focus-visible:ring-offset-2";

// Ajakan saat tidak ada jadwal yang cocok (empty state & kotak penutup).
function InHouseCta({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/kontak" className={cn(buttonVariants({ variant: compact ? "secondary" : "primary" }), "gap-2")}>
      Ajukan jadwal in-house
      <ButtonArrow />
    </Link>
  );
}

function EmptyState({ filtered, calendar }: { filtered: boolean; calendar: boolean }) {
  return (
    <div className="border border-dashed border-border-strong px-6 py-10 text-center">
      <p className="text-h3 text-fg-strong">{calendar ? "Belum ada sesi di bulan ini." : "Belum ada sesi untuk filter ini."}</p>
      <p className="mx-auto mt-2 max-w-[60ch] text-body text-fg-muted">
        {filtered || calendar
          ? "Coba bulan, kota, atau kategori lain, atau minta jadwal in-house untuk tim Anda."
          : "Jadwal baru akan diumumkan di sini. Sementara itu, kelas in-house bisa dijadwalkan sesuai waktu tim Anda."}
      </p>
      <div className="mt-6 flex justify-center">
        <InHouseCta />
      </div>
    </div>
  );
}

export async function ScheduleList({ searchParams }: { searchParams: PageProps<"/jadwal">["searchParams"] }) {
  const state = parseScheduleState(await searchParams);
  // Pilihan bulan & bulan kalender bergantung pada tanggal hari ini: dihitung per request (Suspense).
  await connection();
  const now = new Date();
  const calendar = state.tampilan === "kalender";
  const calendarMonth = state.bulan ?? monthParam(now);
  const [list, categories, settings] = await Promise.all([
    calendar ? getSchedules({ ...state, bulan: calendarMonth, hal: 1, per: CALENDAR_PER }) : getSchedules(state),
    getCategories(),
    getSettings(),
  ]);
  const { items, meta } = list;
  const months = monthOptions(now);
  // Kota terpilih tetap muncul di pilihan walau tidak ada di daftar kota saat ini.
  const cities = state.kota && !meta.cities.includes(state.kota) ? [state.kota, ...meta.cities] : meta.cities;
  const filtered = Boolean(state.bulan || state.kota || state.kategori);
  const siteUrl = getPublicEnv().NEXT_PUBLIC_SITE_URL;

  return (
    <>
      <JsonLd
        data={items
          .filter((item) => item.status !== "COMPLETED")
          .map((item) =>
            scheduleEventJsonLd(
              { ...item, title: displayTitle(item.training.title), slug: item.training.slug },
              siteUrl,
              settings.identity.name,
            ),
          )}
      />
      <div className="flex flex-col gap-6 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between">
        <Form action="/jadwal" className="grid flex-1 gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-end">
          {calendar ? <input type="hidden" name="tampilan" value="kalender" /> : null}
          <div className="space-y-2">
            <label htmlFor="jadwal-bulan" className="font-mono text-label uppercase tracking-[0.08em] text-fg-muted">
              Bulan
            </label>
            <select id="jadwal-bulan" name="bulan" defaultValue={state.bulan ?? ""} className={selectClass}>
              <option value="">{calendar ? "Bulan ini" : "Semua yang akan datang"}</option>
              {months.map((month) => (
                <option key={month.value} value={month.value}>
                  {month.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label htmlFor="jadwal-kota" className="font-mono text-label uppercase tracking-[0.08em] text-fg-muted">
              Kota
            </label>
            <select id="jadwal-kota" name="kota" defaultValue={state.kota ?? ""} className={selectClass}>
              <option value="">Semua kota</option>
              {cities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label htmlFor="jadwal-kategori" className="font-mono text-label uppercase tracking-[0.08em] text-fg-muted">
              Kategori
            </label>
            <select id="jadwal-kategori" name="kategori" defaultValue={state.kategori ?? ""} className={selectClass}>
              <option value="">Semua kategori</option>
              {categories.map((category) => (
                <option key={category.slug} value={category.slug}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button type="submit" className={buttonVariants({ variant: "primary" })}>
              Terapkan
            </button>
            {filtered ? (
              <Link href={scheduleHref(state, { bulan: undefined, kota: undefined, kategori: undefined })} className={buttonVariants({ variant: "secondary" })}>
                Atur ulang
              </Link>
            ) : null}
          </div>
        </Form>
        {/* Tampilan list/kalender (pilih satu): indikator bergeser (FLIP, DESIGN 9.2). */}
        <div role="group" aria-label="Tampilan">
          <ActiveIndicator variant="pill" className="flex gap-2">
            <ChipLink href={scheduleHref(state, { tampilan: "list" })} active={!calendar}>
              List
            </ChipLink>
            <ChipLink href={scheduleHref(state, { tampilan: "kalender" })} active={calendar}>
              Kalender
            </ChipLink>
          </ActiveIndicator>
        </div>
      </div>

      {calendar ? (
        <ScheduleCalendar
          month={calendarMonth}
          items={items}
          prevHref={scheduleHref(state, { bulan: shiftMonth(calendarMonth, -1) })}
          nextHref={scheduleHref(state, { bulan: shiftMonth(calendarMonth, 1) })}
          empty={<EmptyState filtered={filtered} calendar />}
        />
      ) : (
        <>
          <p className="mt-6 font-mono text-label font-medium uppercase tracking-[0.08em] text-fg-strong" role="status">
            {formatNumber(meta.total)} sesi{meta.upcomingOnly ? " yang akan datang" : ""}
          </p>
          <div className="mt-4">
            {items.length > 0 ? (
              <ScheduleTable rows={items} caption="Jadwal pelatihan" showTraining bigDate />
            ) : (
              <EmptyState filtered={filtered} calendar={false} />
            )}
          </div>
          <div className="mt-12">
            <Pagination meta={meta} hrefFor={(page) => scheduleHref(state, { hal: page })} />
          </div>
        </>
      )}

      {/* Kotak penutup (mockup): hanya kalau ada sesi; saat kosong ajakannya ada di empty state. */}
      {items.length > 0 ? (
        <div className="mt-14 flex flex-col gap-6 border border-border p-6 sm:flex-row sm:items-center sm:justify-between md:p-8">
          <div>
            <p className="text-h3 text-fg-strong">Tidak ada jadwal yang cocok?</p>
            <p className="mt-1.5 text-body text-fg-muted">Kelas in-house bisa dijadwalkan sesuai waktu tim Anda.</p>
          </div>
          <InHouseCta />
        </div>
      ) : null}
    </>
  );
}

// Statistik kepala halaman: sesi bulan ini & kota aktif (dari jadwal publik). Angka 0 disembunyikan.
export async function ScheduleStats() {
  await connection();
  const month = monthParam(new Date());
  const [thisMonth, upcoming] = await Promise.all([getSchedules({ bulan: month, per: 1 }), getSchedules({ per: 1 })]);
  const monthName = new Date(`${month}-01T00:00:00Z`).toLocaleDateString("id-ID", { month: "short", timeZone: "UTC" }).replace(".", "");
  const stats = [
    thisMonth.meta.total > 0 ? { value: thisMonth.meta.total, label: `Sesi / ${monthName}` } : null,
    upcoming.meta.cities.length > 0 ? { value: upcoming.meta.cities.length, label: "Kota / aktif" } : null,
  ].filter((stat): stat is { value: number; label: string } => stat !== null);
  if (stats.length === 0) return null;
  return (
    <dl className="flex gap-8">
      {stats.map((stat) => (
        <div key={stat.label} className="flex flex-col-reverse">
          <dt className="mt-2 font-mono text-label uppercase tracking-[0.08em] text-fg-muted">{stat.label}</dt>
          <dd className="font-mono text-[40px] leading-none font-medium tracking-[-0.03em] text-fg-strong">
            {String(stat.value).padStart(2, "0")}
          </dd>
        </div>
      ))}
    </dl>
  );
}
