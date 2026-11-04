import { SearchIcon, XIcon } from "lucide-react";
import Form from "next/form";
import Link from "next/link";
import type { ReactNode } from "react";
import { ActiveIndicator } from "@/components/motion/active-indicator";
import { CategoryIndexButton, FilterDisclosure } from "@/components/public/catalog-filters";
import { ChipLink } from "@/components/public/chip-link";
import { Pagination } from "@/components/public/pagination";
import { TrainingGrid } from "@/components/public/training-card";
import { buttonVariants } from "@/components/ui/button";
import { getCatalog, getCategories } from "@/lib/api/public";
import type { PublicCategory } from "@/lib/api/types";
import {
  catalogHref,
  hasFilters,
  METHOD_PARAMS,
  parseCatalogState,
  toCatalogParams,
  TYPE_PARAMS,
  type CatalogState,
} from "@/lib/catalog-url";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

const METHOD_TEXT: Record<(typeof METHOD_PARAMS)[number], string> = {
  online: "Online",
  offline: "Offline",
  hybrid: "Hybrid",
};
const TYPE_TEXT: Record<(typeof TYPE_PARAMS)[number], string> = { public: "Public", "in-house": "In-house" };
// Kategori di sidebar (10 pertama urut abjad, keputusan pemilik 15 Okt); sisanya lewat "Tampilkan semua" yang
// membuka overlay indeks A-Z (PRD 5.2). Tiap kategori adalah tautan ke halaman kategori v2, bukan filter.
const VISIBLE_CATEGORIES = 10;
// 15 per halaman (keputusan sebelumnya, pas untuk 3 kolom).
const PAGE_SIZE = 15;

export async function Catalog({ searchParams }: { searchParams: PageProps<"/pelatihan">["searchParams"] }) {
  const state = parseCatalogState(await searchParams);
  const [catalog, categories] = await Promise.all([getCatalog(toCatalogParams(state, PAGE_SIZE)), getCategories()]);
  const { items, meta } = catalog;
  const filtered = hasFilters(state);
  // Kategori bukan filter lagi; hanya metode & tipe yang dihitung aktif.
  const activeCount = (state.metode ? 1 : 0) + (state.tipe ? 1 : 0);

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-start lg:gap-6">
      <aside aria-label="Filter" className="lg:sticky lg:top-24 lg:col-span-3 lg:max-h-[calc(100dvh-7rem)] lg:overflow-y-auto lg:pr-2">
        <FilterDisclosure defaultOpen={activeCount > 0} activeCount={activeCount}>
          <div className="flex items-center justify-between border-b border-border pb-4">
            <p className="font-mono text-label font-medium uppercase tracking-[0.08em] text-fg-strong">Filter</p>
            {activeCount > 0 ? (
              <Link
                href={catalogHref(state, { metode: null, tipe: null })}
                scroll={false}
                className="rounded-sm text-small text-fg-muted underline underline-offset-4 outline-none hover:text-fg-strong focus-visible:ring-2 focus-visible:ring-focus"
              >
                Reset
              </Link>
            ) : null}
          </div>
          <CategoryLinks categories={categories} />
          <FilterGroup label="Metode">
            <ChipLink href={catalogHref(state, { metode: null })} active={!state.metode}>
              Semua
            </ChipLink>
            {METHOD_PARAMS.map((method) => (
              <ChipLink key={method} href={catalogHref(state, { metode: method })} active={state.metode === method}>
                {METHOD_TEXT[method]}
              </ChipLink>
            ))}
          </FilterGroup>
          <FilterGroup label="Tipe" last>
            <ChipLink href={catalogHref(state, { tipe: null })} active={!state.tipe}>
              Semua
            </ChipLink>
            {TYPE_PARAMS.map((type) => (
              <ChipLink key={type} href={catalogHref(state, { tipe: type })} active={state.tipe === type}>
                {TYPE_TEXT[type]}
              </ChipLink>
            ))}
          </FilterGroup>
        </FilterDisclosure>
      </aside>

      <div className="min-w-0 lg:col-span-9">
        <div className="mb-8 flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <p className="font-mono text-label font-medium uppercase tracking-[0.08em] text-fg-strong" role="status">
              {formatNumber(meta.total)} pelatihan
              {state.q ? <span className="normal-case tracking-normal text-fg-muted"> untuk “{state.q}”</span> : null}
            </p>
            <ActiveFilterChips state={state} />
          </div>
          <SortLinks state={state} />
        </div>

        {items.length > 0 ? (
          <TrainingGrid trainings={items} headingLevel="h2" narrow />
        ) : (
          <div className="border border-dashed border-border-strong px-6 py-16 text-center">
            <p className="font-mono text-label uppercase tracking-[0.08em] text-fg-muted">0 hasil</p>
            <p className="mt-3 text-h3 text-fg-strong">
              {meta.total > 0 ? "Halaman ini kosong." : "Pelatihan tidak ditemukan."}
            </p>
            <p className="mx-auto mt-2 max-w-[65ch] text-body text-fg-muted">
              {meta.total > 0
                ? "Kembali ke halaman pertama hasil pencarian."
                : "Coba kata kunci lain, periksa ejaan, atau kurangi filter."}
            </p>
            {filtered || state.hal > 1 ? (
              <Link
                href={meta.total > 0 ? catalogHref(state) : "/pelatihan"}
                className={cn(buttonVariants({ variant: "secondary" }), "mt-6")}
              >
                {meta.total > 0 ? "Ke halaman pertama" : "Reset filter"}
              </Link>
            ) : null}
          </div>
        )}

        <div className="mt-16">
          <Pagination meta={meta} hrefFor={(page) => catalogHref(state, { hal: page })} />
        </div>
      </div>
    </div>
  );
}

// Kotak cari besar di kepala katalog (mockup: 56 px, garis --fg-strong). Filter metode/tipe ikut terbawa.
export function CatalogSearch({ state }: { state?: CatalogState }) {
  return (
    // next/form: navigasi GET di sisi klien, tetap jalan sebagai form biasa tanpa JavaScript.
    <Form action="/pelatihan" role="search">
      <label
        htmlFor="catalog-q"
        className="mb-2 block font-mono text-label font-medium uppercase tracking-[0.08em] text-fg-muted"
      >
        Cari pelatihan
      </label>
      <div className="flex h-14 items-center gap-3 rounded-md border border-fg-strong bg-bg pr-1.5 pl-4 focus-within:ring-2 focus-within:ring-focus focus-within:ring-offset-2">
        <SearchIcon className="size-5 shrink-0 text-fg-muted" strokeWidth={1.5} aria-hidden />
        <input
          id="catalog-q"
          name="q"
          type="search"
          defaultValue={state?.q}
          maxLength={100}
          placeholder="Judul, topik, atau kategori"
          className="h-full min-w-0 flex-1 bg-transparent text-body text-fg outline-none placeholder:text-fg-subtle"
        />
        {state?.metode ? <input type="hidden" name="metode" value={state.metode} /> : null}
        {state?.tipe ? <input type="hidden" name="tipe" value={state.tipe} /> : null}
        <button type="submit" className={buttonVariants({ variant: "primary", size: "md" })}>
          Cari
        </button>
      </div>
    </Form>
  );
}

// Grup filter pilih satu: chip aktif ditandai indikator yang bergeser (FLIP, DESIGN 9.2).
function FilterGroup({ label, last, children }: { label: string; last?: boolean; children: ReactNode }) {
  return (
    <div className={cn("py-5", !last && "border-b border-border")}>
      <p aria-hidden className="mb-3 font-mono text-label uppercase tracking-[0.08em] text-fg-muted">
        {label}
      </p>
      <div role="group" aria-label={label}>
        <ActiveIndicator variant="pill" className="flex flex-wrap gap-2">
          {children}
        </ActiveIndicator>
      </div>
    </div>
  );
}

// Daftar kategori sebagai navigasi ke halaman kategori v2 (bukan filter katalog). Menampilkan jumlah
// pelatihan; sisanya lewat "Tampilkan semua" (overlay indeks A-Z), juga menuju halaman kategori.
function CategoryLinks({ categories }: { categories: PublicCategory[] }) {
  const available = categories
    .filter((category) => category.trainingCount > 0)
    .sort((a, b) => a.name.localeCompare(b.name, "id", { sensitivity: "base" }));
  const shown = available.slice(0, VISIBLE_CATEGORIES);

  return (
    <nav aria-label="Kategori" className="border-b border-border py-5">
      <p aria-hidden className="mb-2 font-mono text-label uppercase tracking-[0.08em] text-fg-muted">
        Kategori
      </p>
      <ul className="flex flex-col">
        {shown.map((category) => (
          <li key={category.slug}>
            <Link
              href={`/pelatihan/kategori/${category.slug}`}
              className="group/cat flex min-h-10 items-center gap-3 rounded-sm py-1.5 text-small text-fg outline-none hover:text-primary-ink focus-visible:ring-2 focus-visible:ring-focus"
            >
              <span className="min-w-0 flex-1 group-hover/cat:underline underline-offset-4">{category.name}</span>
              <span className="font-mono text-label text-fg-muted tabular-nums">{category.trainingCount}</span>
            </Link>
          </li>
        ))}
      </ul>
      {available.length > shown.length ? (
        <CategoryIndexButton
          items={available.map((category) => ({
            label: category.name,
            href: `/pelatihan/kategori/${category.slug}`,
            count: category.trainingCount,
          }))}
        />
      ) : null}
    </nav>
  );
}

// Filter aktif (metode/tipe) sebagai chip yang bisa dilepas. Kategori bukan filter lagi.
function ActiveFilterChips({ state }: { state: CatalogState }) {
  const chips = [
    ...(state.metode ? [{ key: "metode", label: METHOD_TEXT[state.metode], href: catalogHref(state, { metode: null }) }] : []),
    ...(state.tipe ? [{ key: "tipe", label: TYPE_TEXT[state.tipe], href: catalogHref(state, { tipe: null }) }] : []),
  ];
  if (chips.length === 0) return null;
  return (
    <ul aria-label="Filter aktif" className="flex flex-wrap gap-2">
      {chips.map((chip) => (
        <li key={chip.key}>
          <Link
            href={chip.href}
            scroll={false}
            aria-label={`Hapus filter ${chip.label}`}
            className="inline-flex h-7 items-center gap-1.5 rounded-full bg-primary px-3 text-[12px] text-on-primary outline-none transition-colors duration-150 hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
          >
            {chip.label}
            <XIcon aria-hidden strokeWidth={1.5} className="size-3.5" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function SortLinks({ state }: { state: CatalogState }) {
  const current = state.urut ?? (state.q ? "relevan" : "terbaru");
  const options = [
    ...(state.q ? [{ value: "relevan" as const, label: "Paling relevan" }] : []),
    { value: "terbaru" as const, label: "Terbaru" },
    { value: "az" as const, label: "A-Z" },
  ];
  return (
    <nav aria-label="Urutkan" className="flex items-center gap-4">
      <span className="text-small text-fg-muted">Urutkan</span>
      <ActiveIndicator variant="line" thickness={2}>
        <ul className="flex gap-4">
          {options.map((option) => (
            <li key={option.value}>
              <Link
                href={catalogHref(state, { urut: option.value })}
                scroll={false}
                aria-current={current === option.value ? "true" : undefined}
                className="rounded-sm text-small text-fg-muted underline-offset-4 outline-none hover:text-fg-strong hover:underline focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 aria-[current=true]:text-fg-strong aria-[current=true]:underline [[data-indicator-ready]_&]:aria-[current=true]:no-underline"
              >
                {option.label}
              </Link>
            </li>
          ))}
        </ul>
      </ActiveIndicator>
    </nav>
  );
}
