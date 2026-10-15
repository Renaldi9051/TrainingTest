import { CheckIcon, SearchIcon, XIcon } from "lucide-react";
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
  toggleCategory,
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
// Kategori di sidebar (10 teratas, keputusan pemilik 15 Okt); sisanya lewat "Tampilkan semua" yang
// membuka overlay indeks A-Z (PRD 5.2).
const VISIBLE_CATEGORIES = 10;
// 15 per halaman (keputusan sebelumnya, pas untuk 3 kolom).
const PAGE_SIZE = 15;

export async function Catalog({ searchParams }: { searchParams: PageProps<"/pelatihan">["searchParams"] }) {
  const state = parseCatalogState(await searchParams);
  const [catalog, categories] = await Promise.all([getCatalog(toCatalogParams(state, PAGE_SIZE)), getCategories()]);
  const { items, meta } = catalog;
  const filtered = hasFilters(state);
  const activeCount = state.kategori.length + (state.metode ? 1 : 0) + (state.tipe ? 1 : 0);

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-start lg:gap-6">
      <aside aria-label="Filter" className="lg:sticky lg:top-24 lg:col-span-3 lg:max-h-[calc(100dvh-7rem)] lg:overflow-y-auto lg:pr-2">
        <FilterDisclosure defaultOpen={activeCount > 0} activeCount={activeCount}>
          <div className="flex items-center justify-between border-b border-border pb-4">
            <p className="font-mono text-label font-medium uppercase tracking-[0.08em] text-fg-strong">Filter</p>
            {activeCount > 0 ? (
              <Link
                href={catalogHref(state, { kategori: [], metode: null, tipe: null })}
                scroll={false}
                className="rounded-sm text-small text-fg-muted underline underline-offset-4 outline-none hover:text-fg-strong focus-visible:ring-2 focus-visible:ring-fg-strong"
              >
                Reset
              </Link>
            ) : null}
          </div>
          <CategoryFilter state={state} categories={categories} />
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
            <ActiveFilterChips state={state} categories={categories} />
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

// Kotak cari besar di kepala katalog (mockup: 56 px, garis --fg-strong). Filter lain ikut terbawa.
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
      <div className="flex h-14 items-center gap-3 rounded-md border border-fg-strong bg-bg pr-1.5 pl-4 focus-within:ring-2 focus-within:ring-fg-strong focus-within:ring-offset-2">
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
        {state && state.kategori.length > 0 ? <input type="hidden" name="kategori" value={state.kategori.join(",")} /> : null}
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

// Kategori pilih banyak: link bergaya kotak centang (state di URL, tanpa JS). Bukan role checkbox;
// yang terpilih ditandai aria-current="true" + teks tersembunyi "terpilih".
function CategoryFilter({ state, categories }: { state: CatalogState; categories: PublicCategory[] }) {
  const available = categories.filter(
    (category) => category.trainingCount > 0 || state.kategori.includes(category.slug),
  );
  // Terpilih & unggulan dulu, lalu yang paling banyak pelatihannya.
  const selected = available.filter((category) => state.kategori.includes(category.slug));
  const rest = available
    .filter((category) => !state.kategori.includes(category.slug))
    .sort((a, b) => Number(b.featured) - Number(a.featured) || b.trainingCount - a.trainingCount);
  const shown = [...selected, ...rest].slice(0, Math.max(VISIBLE_CATEGORIES, selected.length));

  return (
    <div className="border-b border-border py-5">
      <p aria-hidden className="mb-2 font-mono text-label uppercase tracking-[0.08em] text-fg-muted">
        Kategori
      </p>
      <div role="group" aria-label="Kategori" className="flex flex-col">
        <CheckLink href={catalogHref(state, { kategori: [] })} active={state.kategori.length === 0}>
          Semua kategori
        </CheckLink>
        {shown.map((category) => (
          <CheckLink
            key={category.slug}
            href={toggleCategory(state, category.slug)}
            active={state.kategori.includes(category.slug)}
            count={category.trainingCount}
          >
            {category.name}
          </CheckLink>
        ))}
      </div>
      {available.length > shown.length ? (
        <CategoryIndexButton
          items={available.map((category) => ({
            label: category.name,
            href: toggleCategory(state, category.slug),
            count: category.trainingCount,
          }))}
        />
      ) : null}
    </div>
  );
}

function CheckLink({
  href,
  active,
  count,
  children,
}: {
  href: string;
  active: boolean;
  count?: number;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? "true" : undefined}
      className="group/check flex min-h-10 items-center gap-3 rounded-sm py-1.5 text-small text-fg outline-none hover:text-fg-strong focus-visible:ring-2 focus-visible:ring-fg-strong"
    >
      <span
        aria-hidden
        className={cn(
          "flex size-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors duration-150",
          active ? "border-fg-strong bg-fg-strong text-inverse-fg" : "border-border-strong group-hover/check:border-fg-strong",
        )}
      >
        {active ? <CheckIcon strokeWidth={2} className="size-3" /> : null}
      </span>
      <span className={cn("min-w-0 flex-1", active && "font-medium text-fg-strong")}>
        {children}
        {active ? <span className="sr-only">, terpilih</span> : null}
      </span>
      {count !== undefined ? <span className="font-mono text-label text-fg-muted tabular-nums">{count}</span> : null}
    </Link>
  );
}

// Filter aktif sebagai chip yang bisa dilepas (mockup).
function ActiveFilterChips({ state, categories }: { state: CatalogState; categories: PublicCategory[] }) {
  const names = new Map(categories.map((category) => [category.slug, category.name]));
  const chips = [
    ...state.kategori.map((slug) => ({ key: `k-${slug}`, label: names.get(slug) ?? slug, href: toggleCategory(state, slug) })),
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
            className="inline-flex h-7 items-center gap-1.5 rounded-full bg-fg-strong px-3 text-[12px] text-inverse-fg outline-none transition-colors duration-150 hover:bg-fg focus-visible:ring-2 focus-visible:ring-fg-strong focus-visible:ring-offset-2"
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
      <ActiveIndicator variant="line">
        <ul className="flex gap-4">
          {options.map((option) => (
            <li key={option.value}>
              <Link
                href={catalogHref(state, { urut: option.value })}
                scroll={false}
                aria-current={current === option.value ? "true" : undefined}
                className="rounded-sm text-small text-fg-muted underline-offset-4 outline-none hover:text-fg-strong hover:underline focus-visible:ring-2 focus-visible:ring-fg-strong focus-visible:ring-offset-2 aria-[current=true]:text-fg-strong aria-[current=true]:underline [[data-indicator-ready]_&]:aria-[current=true]:no-underline"
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
