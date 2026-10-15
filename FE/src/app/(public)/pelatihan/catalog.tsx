import Link from "next/link";
import { ActiveIndicator } from "@/components/motion/active-indicator";
import { Pagination } from "@/components/public/pagination";
import { TrainingGrid } from "@/components/public/training-card";
import { buttonVariants } from "@/components/ui/button";
import { getCatalog } from "@/lib/api/public";
import { catalogHref, hasFilters, parseCatalogState, toCatalogParams, type CatalogState } from "@/lib/catalog-url";
import { formatNumber } from "@/lib/format";

// Kategori hanya dipilih lewat dropdown menu Pelatihan di header; halaman ini tidak punya panel filter.
export async function Catalog({ searchParams }: { searchParams: PageProps<"/pelatihan">["searchParams"] }) {
  const state = parseCatalogState(await searchParams);
  const { items, meta } = await getCatalog(toCatalogParams(state, 15));

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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
          <TrainingGrid trainings={items} headingLevel="h2" variant="reference" />
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
