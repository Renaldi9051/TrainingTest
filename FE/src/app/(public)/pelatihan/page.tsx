import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { GrainOverlay } from "@/components/decor/grain-overlay";
import { CategoryGrid, CategoryGridSkeleton } from "@/components/public/category-card";
import { CategorySearch, CategorySearchForm } from "@/components/public/category-search";
import { JsonLd } from "@/components/public/json-ld";
import { OpenSearchHint } from "@/components/public/open-search-hint";
import { PageHero } from "@/components/public/page-hero";
import { Pagination } from "@/components/public/pagination";
import { buttonVariants } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { getCatalog, getCategories, getCategoryGrid, getSettings } from "@/lib/api/public";
import { gridCanonical, gridHref, parseGridState } from "@/lib/category-grid-url";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

// /pelatihan = grid semua kategori (keputusan atasan 5 Nov 2026), bukan katalog kartu pelatihan.
// Klik kartu -> /pelatihan/kategori/[slug]. Judul pelatihan dicari lewat command palette (Ctrl K).
// URL katalog lama (?kategori=, ?metode=, ?tipe=, ?sort=/urut=, ?hal=) dialihkan 308 di src/proxy.ts.

export async function generateMetadata({ searchParams }: PageProps<"/pelatihan">): Promise<Metadata> {
  const [settings, requested] = await Promise.all([getSettings(), searchParams.then(parseGridState)]);
  // Halaman di luar batas dirender sebagai halaman terakhir (BE menjepit page); canonical ikut.
  const { meta } = await getCategoryGrid(requested.q, requested.page);
  const state = { q: requested.q, page: meta.page };
  return {
    title: state.page > 1 ? `Pelatihan, halaman ${state.page}` : "Pelatihan",
    description: settings.seo.description || undefined,
    alternates: { canonical: gridCanonical(state) },
  };
}

export default async function TrainingCategoriesPage({ searchParams }: PageProps<"/pelatihan">) {
  // Data ringkas di-cache (tanpa data request), jadi kepala halaman tetap ikut prerender.
  const [categories, catalog] = await Promise.all([getCategories(), getCatalog({ per: 1 })]);
  const lead = `${formatNumber(categories.length)} kategori, ${formatNumber(catalog.meta.total)} judul. Buka kategori untuk melihat daftar judul, target peserta, dan galeri kegiatannya.`;

  return (
    <>
      <PageHero
        crumbs={[{ label: "Pelatihan" }]}
        title="Pilih kategori pelatihan"
        lead={lead}
        dots
        aside={
          <div className="space-y-3">
            {/* q dibaca dari URL di klien; kerangka form tampil dulu tanpa nilai. */}
            <Suspense fallback={<CategorySearchForm />}>
              <CategorySearch />
            </Suspense>
            <OpenSearchHint />
          </div>
        }
      />
      <Container className="pt-12 pb-16 md:pt-16 md:pb-20">
        {/* q & page dibaca dari URL saat request, jadi bagian ini di-stream di dalam Suspense. */}
        <Suspense fallback={<CategoryGridSkeleton />}>
          <CategoryResults searchParams={searchParams} />
        </Suspense>
      </Container>
      <ClosingCta />
    </>
  );
}

async function CategoryResults({ searchParams }: { searchParams: PageProps<"/pelatihan">["searchParams"] }) {
  const requested = parseGridState(await searchParams);
  const { items, meta } = await getCategoryGrid(requested.q, requested.page);
  const state = { q: requested.q, page: meta.page };
  const from = (meta.page - 1) * meta.pageSize + 1;
  const to = from + items.length - 1;

  // JSON-LD ItemList: kategori di halaman ini, posisi mengikuti urutan global.
  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Kategori pelatihan",
    numberOfItems: meta.total,
    itemListElement: items.map((category, index) => ({
      "@type": "ListItem",
      position: from + index,
      name: category.name,
      url: `/pelatihan/kategori/${category.slug}`,
    })),
  };

  return (
    <>
      {items.length > 0 ? <JsonLd data={itemList} /> : null}
      <div className="mb-8 flex flex-col gap-2 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
        <p role="status" className="font-mono text-label font-medium uppercase tracking-[0.08em] text-fg-strong">
          {formatNumber(meta.total)} {state.q ? "kategori cocok" : "kategori"}
        </p>
        <p className="text-small text-fg-muted">Urutan: unggulan dulu, lalu A-Z</p>
      </div>

      {items.length > 0 ? (
        <CategoryGrid categories={items} />
      ) : (
        <div className="rounded-card border border-dashed border-border-strong px-6 py-16 text-center">
          <p className="font-mono text-label uppercase tracking-[0.08em] text-fg-muted">0 hasil</p>
          <p className="mt-3 text-h3 text-fg-strong">
            {state.q ? `Kategori “${state.q}” tidak ditemukan` : "Belum ada kategori."}
          </p>
          {state.q ? (
            <>
              <p className="mx-auto mt-2 max-w-[65ch] text-body text-fg-muted">
                Coba nama lain, atau cari langsung judul pelatihannya.
              </p>
              <div className="mt-6 flex flex-col items-center gap-4">
                <OpenSearchHint />
                <Link href="/pelatihan" className={buttonVariants({ variant: "secondary" })}>
                  Lihat semua kategori
                </Link>
              </div>
            </>
          ) : null}
        </div>
      )}

      <div className="mt-12">
        <Pagination
          meta={meta}
          hrefFor={(page) => gridHref({ ...state, page })}
          info={`Halaman ${meta.page} dari ${meta.totalPages} / ${from}-${to} dari ${formatNumber(meta.total)}`}
        />
      </div>
    </>
  );
}

// CTA penutup (palet D: permukaan biru, tombol mustard).
function ClosingCta() {
  return (
    <section aria-labelledby="pelatihan-cta" className="pb-24 md:pb-32">
      <Container>
        <div
          data-surface="secondary"
          className="relative flex flex-col gap-8 overflow-hidden rounded-card bg-inverse-bg px-6 py-12 text-inverse-fg md:flex-row md:items-center md:justify-between md:px-16 md:py-16"
        >
          <GrainOverlay tone="inverse" />
          <h2 id="pelatihan-cta" className="relative max-w-[20ch] text-h2">
            Tidak menemukan topik yang dicari?
          </h2>
          <Link href="/kontak" className={cn(buttonVariants({ variant: "inverse", size: "lg" }), "relative self-start md:self-auto")}>
            Request pelatihan in-house <span aria-hidden className="ml-2">→</span>
          </Link>
        </div>
      </Container>
    </section>
  );
}
