import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { GrainOverlay } from "@/components/decor/grain-overlay";
import { PlusMarker } from "@/components/decor/plus-marker";
import { RotatingBadge } from "@/components/decor/rotating-badge";
import { CategoryGridSkeleton, CategoryGroups } from "@/components/public/category-card";
import { CategorySearch, CategorySearchForm } from "@/components/public/category-search";
import { JsonLd } from "@/components/public/json-ld";
import { OpenSearchHint } from "@/components/public/open-search-hint";
import { PageHero } from "@/components/public/page-hero";
import { Pagination } from "@/components/public/pagination";
import { buttonVariants } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Eyebrow } from "@/components/ui/eyebrow";
import { getCatalog, getCategories, getCategoryGrid, getSettings } from "@/lib/api/public";
import { gridCanonical, gridHref, parseGridState } from "@/lib/category-grid-url";
import { formatNumber } from "@/lib/format";

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
  const featuredTotal = categories.filter((category) => category.featured).length;
  const stats = [
    { value: categories.length, label: "Kategori" },
    { value: catalog.meta.total, label: "Judul pelatihan" },
    { value: featuredTotal, label: "Unggulan" },
  ].filter((stat) => stat.value > 0);

  return (
    <>
      <PageHero
        crumbs={[{ label: "Pelatihan" }]}
        eyebrow="Katalog / Kategori"
        title="Pilih kategori pelatihan"
        lead="Buka kategori untuk melihat daftar judul, target peserta, dan galeri kegiatannya."
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
      >
        {stats.length > 0 ? <HeroStats stats={stats} /> : null}
      </PageHero>
      <Container className="pt-10 pb-16 md:pt-14 md:pb-24">
        {/* q & page dibaca dari URL saat request, jadi bagian ini di-stream di dalam Suspense. */}
        <Suspense fallback={<CategoryGridSkeleton />}>
          <CategoryResults searchParams={searchParams} featuredTotal={featuredTotal} />
        </Suspense>
      </Container>
      <ClosingCta />
    </>
  );
}

// Angka ringkas di kepala halaman (mono --primary-ink, DESIGN.md 8.6 tanpa kotak): data nyata dari BE,
// angka 0 disembunyikan. PlusMarker di sudut kiri atas baris (maks 2 elemen grafis: DotPattern + ini).
function HeroStats({ stats }: { stats: { value: number; label: string }[] }) {
  return (
    <dl data-page-enter="" className="relative mt-10 grid grid-cols-3 border-t border-border-strong md:mt-14 md:max-w-[640px]">
      <PlusMarker className="-top-1.5 -left-1.5" />
      {stats.map((stat, index) => (
        <div key={stat.label} className={index > 0 ? "border-l border-border pt-4 pl-4 md:pl-6" : "pt-4 pr-4"}>
          <dt className="font-mono text-label font-medium uppercase tracking-[0.08em] text-fg-muted">{stat.label}</dt>
          <dd className="mt-1 font-mono text-[28px] leading-none font-medium tracking-[-0.02em] text-primary-ink md:text-[40px]">
            {formatNumber(stat.value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

async function CategoryResults({
  searchParams,
  featuredTotal,
}: {
  searchParams: PageProps<"/pelatihan">["searchParams"];
  featuredTotal: number;
}) {
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
      <div className="mb-10 flex flex-col gap-2 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between md:mb-12">
        <p role="status" className="font-mono text-label font-medium uppercase tracking-[0.08em] text-fg-strong">
          {formatNumber(meta.total)} {state.q ? "kategori cocok" : "kategori"}
        </p>
        {state.q ? (
          <p className="text-small text-fg-muted">
            Hasil untuk “{state.q}” ·{" "}
            <Link
              href="/pelatihan"
              className="rounded-sm text-link underline underline-offset-4 outline-none hover:text-fg-strong focus-visible:ring-2 focus-visible:ring-focus"
            >
              Hapus pencarian
            </Link>
          </p>
        ) : items.length > 0 ? (
          <p className="font-mono text-label uppercase tracking-[0.08em] text-fg-muted">
            Halaman {meta.page} / {meta.totalPages}
          </p>
        ) : null}
      </div>

      {items.length > 0 ? (
        <CategoryGroups categories={items} offset={from - 1} featuredTotal={state.q ? null : featuredTotal} />
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

      <div className="mt-14 md:mt-16">
        <Pagination
          meta={meta}
          hrefFor={(page) => gridHref({ ...state, page })}
          info={`Halaman ${meta.page} dari ${meta.totalPages} / ${from}-${to} dari ${formatNumber(meta.total)}`}
        />
      </div>
    </>
  );
}

// CTA penutup (DESIGN.md 8.9, palet D): section penuh permukaan biru + GrainOverlay + RotatingBadge,
// tombol mustard. Pola sama dengan CTA penutup landing kategori.
function ClosingCta() {
  return (
    <section
      aria-labelledby="pelatihan-cta"
      data-surface="secondary"
      className="relative overflow-hidden bg-inverse-bg py-20 text-inverse-fg md:py-28"
    >
      <GrainOverlay tone="inverse" />
      <Container className="relative">
        <Eyebrow className="text-accent-on-dark">Pelatihan in-house</Eyebrow>
        <h2 id="pelatihan-cta" className="mt-3 max-w-[18ch] text-h1">
          Tidak menemukan topik yang dicari?
        </h2>
        <p className="mt-4 max-w-[52ch] text-body-lg text-on-secondary">
          Ceritakan kebutuhan tim Anda. Materi, jadwal, dan lokasi bisa disesuaikan.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/kontak" className={buttonVariants({ variant: "inverse", size: "lg" })}>
            Request pelatihan in-house <span aria-hidden className="ml-2">→</span>
          </Link>
          <Link href="/jadwal" className={buttonVariants({ variant: "inverseOutline", size: "lg" })}>
            Lihat jadwal
          </Link>
        </div>
        <RotatingBadge
          href="/kontak"
          text="Konsultasi • Pelatihan in-house •"
          label="Konsultasi pelatihan in-house"
          tone="light"
          className="absolute top-1/2 right-4 hidden -translate-y-1/2 md:block lg:right-6"
        />
      </Container>
    </section>
  );
}
