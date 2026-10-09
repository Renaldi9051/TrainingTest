import { SearchIcon, XIcon } from "lucide-react";
import Form from "next/form";
import Link from "next/link";
import type { ReactNode } from "react";
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

const METHOD_TEXT: Record<(typeof METHOD_PARAMS)[number], string> = {
  online: "Online",
  offline: "Offline",
  hybrid: "Hybrid",
};
const TYPE_TEXT: Record<(typeof TYPE_PARAMS)[number], string> = { public: "Public", "in-house": "In-house" };
const VISIBLE_CATEGORIES = 12;

export async function Catalog({ searchParams }: { searchParams: PageProps<"/pelatihan">["searchParams"] }) {
  const state = parseCatalogState(await searchParams);
  const [catalog, categories] = await Promise.all([getCatalog(toCatalogParams(state)), getCategories()]);
  const { items, meta } = catalog;

  return (
    <div className="mt-10">
      <SearchForm state={state} />

      <div className="mt-10 space-y-6 border-y border-border py-6">
        <CategoryFilter state={state} categories={categories} />
        <FilterRow label="Metode">
          <ChipLink href={catalogHref(state, { metode: null })} active={!state.metode}>
            Semua
          </ChipLink>
          {METHOD_PARAMS.map((method) => (
            <ChipLink key={method} href={catalogHref(state, { metode: method })} active={state.metode === method}>
              {METHOD_TEXT[method]}
            </ChipLink>
          ))}
        </FilterRow>
        <FilterRow label="Tipe">
          <ChipLink href={catalogHref(state, { tipe: null })} active={!state.tipe}>
            Semua
          </ChipLink>
          {TYPE_PARAMS.map((type) => (
            <ChipLink key={type} href={catalogHref(state, { tipe: type })} active={state.tipe === type}>
              {TYPE_TEXT[type]}
            </ChipLink>
          ))}
        </FilterRow>
      </div>

      <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-small text-fg-muted" role="status">
          <span className="font-mono text-fg-strong">{formatNumber(meta.total)}</span> pelatihan
          {state.q ? (
            <>
              {" "}
              untuk <span className="text-fg-strong">“{state.q}”</span>
            </>
          ) : null}
        </p>
        <SortLinks state={state} />
      </div>

      <div className="mt-8">
        {items.length > 0 ? (
          <TrainingGrid trainings={items} />
        ) : (
          <div className="border-t border-border py-16">
            <p className="text-[24px] leading-[1.25] font-medium text-fg-strong">Tidak ada pelatihan yang cocok</p>
            <p className="mt-3 max-w-[65ch] text-body text-fg-muted">
              {meta.total > 0
                ? "Halaman ini kosong. Kembali ke halaman pertama hasil pencarian."
                : "Coba kata kunci lain, periksa ejaan, atau kurangi filter."}
            </p>
            {hasFilters(state) || state.hal > 1 ? (
              <Link
                href={meta.total > 0 ? catalogHref(state) : "/pelatihan"}
                className={`${buttonVariants({ variant: "secondary" })} mt-6`}
              >
                {meta.total > 0 ? "Ke halaman pertama" : "Hapus semua filter"}
              </Link>
            ) : null}
          </div>
        )}
      </div>

      <div className="mt-12">
        <Pagination meta={meta} hrefFor={(page) => catalogHref(state, { hal: page })} />
      </div>
    </div>
  );
}

function SearchForm({ state }: { state: CatalogState }) {
  return (
    // next/form: navigasi GET di sisi klien, tetap jalan sebagai form biasa tanpa JavaScript.
    <Form action="/pelatihan" role="search" className="flex max-w-2xl gap-2">
      <label htmlFor="catalog-q" className="sr-only">
        Cari pelatihan
      </label>
      <div className="relative flex-1">
        <SearchIcon
          className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-fg-muted"
          strokeWidth={1.5}
          aria-hidden
        />
        <input
          id="catalog-q"
          name="q"
          type="search"
          defaultValue={state.q}
          maxLength={100}
          placeholder="Cari judul, topik, atau kategori"
          className="h-12 w-full rounded-md border border-border-strong bg-bg pr-4 pl-12 text-body text-fg outline-none placeholder:text-fg-subtle focus-visible:border-fg-strong focus-visible:ring-2 focus-visible:ring-fg-strong focus-visible:ring-offset-2"
        />
      </div>
      {/* Filter lain ikut terbawa saat mencari. */}
      {state.kategori.length > 0 ? <input type="hidden" name="kategori" value={state.kategori.join(",")} /> : null}
      {state.metode ? <input type="hidden" name="metode" value={state.metode} /> : null}
      {state.tipe ? <input type="hidden" name="tipe" value={state.tipe} /> : null}
      <button type="submit" className={buttonVariants({ variant: "primary", size: "lg" })}>
        Cari
      </button>
    </Form>
  );
}

function FilterRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label} className="flex flex-col gap-3 md:flex-row md:items-start md:gap-6">
      <p aria-hidden className="w-24 shrink-0 pt-2 font-mono text-label uppercase tracking-[0.08em] text-fg-muted">
        {label}
      </p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function CategoryFilter({ state, categories }: { state: CatalogState; categories: PublicCategory[] }) {
  const available = categories.filter(
    (category) => category.trainingCount > 0 || state.kategori.includes(category.slug),
  );
  // Kategori terpilih & unggulan tampil dulu; sisanya di balik "Kategori lain" (tanpa JS).
  const primary = available.filter((category) => category.featured || state.kategori.includes(category.slug));
  const ordered = [...primary, ...available.filter((category) => !primary.includes(category))];
  const shown = ordered.slice(0, Math.max(VISIBLE_CATEGORIES, primary.length));
  const rest = available.filter((category) => !shown.includes(category));
  const chip = (category: PublicCategory) => (
    <ChipLink key={category.slug} href={toggleCategory(state, category.slug)} active={state.kategori.includes(category.slug)}>
      {category.name}
      <span className="ml-2 font-mono text-xs opacity-70">{category.trainingCount}</span>
    </ChipLink>
  );

  return (
    <FilterRow label="Kategori">
      <ChipLink href={catalogHref(state, { kategori: [] })} active={state.kategori.length === 0}>
        Semua
      </ChipLink>
      {shown.map(chip)}
      {rest.length > 0 ? (
        <details className="group w-full">
          <summary className="inline-flex h-8 cursor-pointer list-none items-center gap-1 rounded-sm text-small text-fg underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-fg-strong focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
            <span className="group-open:hidden">Kategori lain ({rest.length})</span>
            <span className="hidden group-open:inline">Sembunyikan kategori lain</span>
          </summary>
          <div className="mt-3 flex flex-wrap gap-2">{rest.map(chip)}</div>
        </details>
      ) : null}
      {state.kategori.length > 1 ? (
        <Link
          href={catalogHref(state, { kategori: [] })}
          className="inline-flex h-8 items-center gap-1 text-small text-fg-muted underline-offset-4 hover:text-fg-strong hover:underline"
        >
          <XIcon className="size-4" strokeWidth={1.5} aria-hidden />
          Hapus pilihan kategori
        </Link>
      ) : null}
    </FilterRow>
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
      <span className="font-mono text-label uppercase tracking-[0.08em] text-fg-muted">Urutkan</span>
      <ul className="flex gap-4">
        {options.map((option) => (
          <li key={option.value}>
            <Link
              href={catalogHref(state, { urut: option.value })}
              scroll={false}
              aria-current={current === option.value ? "true" : undefined}
              className="rounded-sm text-small text-fg-muted underline-offset-4 outline-none hover:text-fg-strong hover:underline focus-visible:ring-2 focus-visible:ring-fg-strong focus-visible:ring-offset-2 aria-[current=true]:text-fg-strong aria-[current=true]:underline"
            >
              {option.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
