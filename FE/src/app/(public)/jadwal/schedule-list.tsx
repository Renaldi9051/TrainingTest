import Form from "next/form";
import Link from "next/link";
import { connection } from "next/server";
import { JsonLd } from "@/components/public/json-ld";
import { Pagination } from "@/components/public/pagination";
import { ScheduleTable } from "@/components/public/schedule-table";
import { buttonVariants } from "@/components/ui/button";
import { getCategories, getSchedules, getSettings, type ScheduleParams } from "@/lib/api/public";
import { getPublicEnv } from "@/lib/env";
import { APP_TIME_ZONE, formatNumber } from "@/lib/format";
import { scheduleEventJsonLd } from "@/lib/structured-data";

type RawParams = Record<string, string | string[] | undefined>;

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

export function parseScheduleState(raw: RawParams): Required<Pick<ScheduleParams, "hal">> & ScheduleParams {
  const bulan = first(raw.bulan);
  const kategori = first(raw.kategori);
  const kota = first(raw.kota).slice(0, 100);
  const hal = Number.parseInt(first(raw.hal), 10);
  return {
    bulan: MONTH.test(bulan) ? bulan : undefined,
    kota: kota || undefined,
    kategori: SLUG.test(kategori) ? kategori : undefined,
    hal: Number.isFinite(hal) && hal > 1 ? Math.min(hal, 1000) : 1,
  };
}

function scheduleHref(state: ScheduleParams, page: number): string {
  const params = new URLSearchParams();
  if (state.bulan) params.set("bulan", state.bulan);
  if (state.kota) params.set("kota", state.kota);
  if (state.kategori) params.set("kategori", state.kategori);
  if (page > 1) params.set("hal", String(page));
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

export async function ScheduleList({ searchParams }: { searchParams: PageProps<"/jadwal">["searchParams"] }) {
  const state = parseScheduleState(await searchParams);
  const [list, categories, settings] = await Promise.all([getSchedules(state), getCategories(), getSettings()]);
  const { items, meta } = list;
  // Pilihan bulan bergantung pada tanggal hari ini: dihitung per request (bagian ini sudah di Suspense).
  await connection();
  const months = monthOptions(new Date());
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
              { ...item, title: item.training.title, slug: item.training.slug },
              siteUrl,
              settings.identity.name,
            ),
          )}
      />

      <Form action="/jadwal" className="mt-10 grid gap-4 border-y border-border py-6 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-end">
        <div className="space-y-2">
          <label htmlFor="jadwal-bulan" className="font-mono text-label uppercase tracking-[0.08em] text-fg-muted">
            Bulan
          </label>
          <select id="jadwal-bulan" name="bulan" defaultValue={state.bulan ?? ""} className={selectClass}>
            <option value="">Semua yang akan datang</option>
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
            <Link href="/jadwal" className={buttonVariants({ variant: "secondary" })}>
              Atur ulang
            </Link>
          ) : null}
        </div>
      </Form>

      <p className="mt-8 text-small text-fg-muted" role="status">
        <span className="font-mono text-fg-strong">{formatNumber(meta.total)}</span> sesi
        {meta.upcomingOnly ? " yang akan datang" : ""}
      </p>

      <div className="mt-6">
        {items.length > 0 ? (
          <ScheduleTable rows={items} caption="Jadwal pelatihan" showTraining />
        ) : (
          <div className="border-t border-border py-16">
            <p className="text-[24px] leading-[1.25] font-medium text-fg-strong">Tidak ada jadwal yang cocok</p>
            <p className="mt-3 max-w-[65ch] text-body text-fg-muted">
              {filtered ? "Coba bulan, kota, atau kategori lain." : "Jadwal baru akan segera diumumkan."}
            </p>
          </div>
        )}
      </div>

      <div className="mt-12">
        <Pagination meta={meta} hrefFor={(page) => scheduleHref(state, page)} />
      </div>
    </>
  );
}
