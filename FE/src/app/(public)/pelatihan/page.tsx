import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { GrainOverlay } from "@/components/decor/grain-overlay";
import { OutlineText } from "@/components/decor/outline-text";
import { BENTO_SIZE, CategoryBento } from "@/components/public/category-bento";
import { CategoryGrid, CategoryGridSkeleton } from "@/components/public/category-card";
import { CategoryLetterIndex } from "@/components/public/category-letter-index";
import { CategorySearch, CategorySearchForm } from "@/components/public/category-search";
import { ChipLink } from "@/components/public/chip-link";
import { JsonLd } from "@/components/public/json-ld";
import { OpenSearchHint } from "@/components/public/open-search-hint";
import { Breadcrumb } from "@/components/public/page-hero";
import { Pagination } from "@/components/public/pagination";
import { buttonVariants } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Eyebrow } from "@/components/ui/eyebrow";
import { getCatalog, getCategories, getCategoryGrid, getSettings } from "@/lib/api/public";
import type { PageHeader, PublicCategory, TrainingsPage } from "@/lib/api/types";
import { parseAccentHeading } from "@/lib/accent-heading";
import { gridCanonical, gridHref, parseGridState } from "@/lib/category-grid-url";
import { formatNumber } from "@/lib/format";
import { indexLetter } from "@/lib/index-groups";
import { withPageHeaderDefaults, withTrainingsPageDefaults } from "@/lib/page-text-defaults";
import { cn } from "@/lib/utils";

// /pelatihan = grid semua kategori (keputusan atasan 5 Nov 2026), bukan katalog kartu pelatihan.
// Tata letak dari mockup redesign pemilik (5 Nov 2026): kepala + cari, bento 5 kategori unggulan
// (urutan admin), grid A-Z dengan indeks huruf + paginasi, CTA in-house biru berbingkai.
// Klik kartu -> /pelatihan/kategori/[slug]. Judul pelatihan dicari lewat command palette (Ctrl K).
// URL katalog lama (?kategori=, ?metode=, ?tipe=, ?sort=/urut=, ?hal=) dialihkan 308 di src/proxy.ts.

// Anchor grid A-Z: paginasi melompat ke sini (kepala & bento tetap di atasnya).
const GRID_ANCHOR = "semua";
// Contoh kategori di bawah kotak cari: unggulan berikutnya setelah bento.
const EXAMPLE_CHIPS = 4;
export async function generateMetadata({ searchParams }: PageProps<"/pelatihan">): Promise<Metadata> {
  const [settings, requested] = await Promise.all([getSettings(), searchParams.then(parseGridState)]);
  // Halaman di luar batas dirender sebagai halaman terakhir (BE menjepit page); canonical ikut.
  const { meta } = await getCategoryGrid(requested.q, requested.huruf, requested.page);
  const state = { ...requested, page: meta.page };
  return {
    title: state.page > 1 ? `Pelatihan, halaman ${state.page}` : "Pelatihan",
    description: settings.seo.description || undefined,
    alternates: { canonical: gridCanonical(state) },
  };
}

export default async function TrainingCategoriesPage({ searchParams }: PageProps<"/pelatihan">) {
  // Data ringkas di-cache (tanpa data request), jadi kepala halaman & bento ikut prerender.
  const [categories, catalog, settings] = await Promise.all([getCategories(), getCatalog({ per: 1 }), getSettings()]);
  // Field setting yang kosong = teks bawaan (lib/page-text-defaults, sama dengan isi awal form admin).
  const texts = withTrainingsPageDefaults(settings.trainingsPage);
  // getCategories() urut order admin lalu nama: 5 unggulan pertama ke bento, 4 berikutnya jadi contoh.
  const featured = categories.filter((category) => category.featured);
  const bento = featured.slice(0, BENTO_SIZE);
  const examples = featured.slice(BENTO_SIZE, BENTO_SIZE + EXAMPLE_CHIPS);
  // Jumlah per huruf indeks dari daftar kategori publik (filter sama dengan grid BE).
  const letterCounts: Record<string, number> = {};
  for (const category of categories) {
    const letter = indexLetter(category.name);
    letterCounts[letter] = (letterCounts[letter] ?? 0) + 1;
  }

  return (
    <>
      <Hero
        header={withPageHeaderDefaults("pelatihan", settings.pageHeaders.pelatihan)}
        categoryTotal={categories.length}
        trainingTotal={catalog.meta.total}
        examples={examples}
      />

      {bento.length > 0 ? (
        <section aria-labelledby="kategori-unggulan" className="pt-16 md:pt-22">
          <Container>
            <SectionHead
              id="kategori-unggulan"
              index="01"
              eyebrow={texts.featured.eyebrow}
              title={texts.featured.heading}
              aside={texts.featured.lead}
            />
            <CategoryBento categories={bento} />
          </Container>
        </section>
      ) : null}

      <section id={GRID_ANCHOR} aria-labelledby="kategori-semua" className="scroll-mt-24 pt-16 md:pt-22">
        <Container>
          <SectionHead
            id="kategori-semua"
            index={bento.length > 0 ? "02" : "01"}
            eyebrow={texts.all.eyebrow}
            title={texts.all.heading}
          />
          {/* q, huruf & page dibaca dari URL saat request, jadi bagian ini di-stream di dalam Suspense. */}
          <Suspense
            fallback={
              <>
                <div className="mb-7 h-[69px] border-t border-b border-t-fg-strong border-b-border" />
                <CategoryGridSkeleton />
              </>
            }
          >
            <CategoryResults searchParams={searchParams} letterCounts={letterCounts} />
          </Suspense>
        </Container>
      </section>

      <ClosingCta cta={texts.cta} />
    </>
  );
}

// Kepala halaman (mockup .hero): latar --bg-subtle, breadcrumb, eyebrow opsional, h1 dengan satu kata
// aksen outline (DESIGN.md 3; dari CMS lewat penanda *kata*), lead diawali jumlah nyata dari BE; kolom
// kanan kotak cari kategori + contoh kategori unggulan di luar bento. Teks dari setting
// page.headers.pelatihan, kosong = bawaan. Langsung terbaca (layar pertama); stagger hanya setelah
// navigasi klien.
function Hero({
  header,
  categoryTotal,
  trainingTotal,
  examples,
}: {
  header: PageHeader;
  categoryTotal: number;
  trainingTotal: number;
  examples: PublicCategory[];
}) {
  const totals = [
    categoryTotal > 0 ? `${formatNumber(categoryTotal)} kategori` : null,
    trainingTotal > 0 ? `${formatNumber(trainingTotal)} judul` : null,
  ].filter(Boolean);
  const heading = parseAccentHeading(header.heading);
  return (
    <section className="border-b border-border bg-bg-subtle py-10 md:py-14">
      <Container className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-end lg:gap-14">
        <div className="lg:col-span-7">
          <Breadcrumb crumbs={[{ label: "Pelatihan" }]} />
          {header.eyebrow ? (
            <Eyebrow data-page-enter="" className="mb-4">
              {header.eyebrow}
            </Eyebrow>
          ) : null}
          <h1
            data-page-enter=""
            className="max-w-[14ch] text-h1 text-fg-strong lg:text-[68px] lg:leading-[0.98] lg:tracking-[-0.03em]"
          >
            {heading.before}
            {heading.accent ? (
              <span className="text-transparent [-webkit-text-stroke:1.5px_var(--fg-strong)]">{heading.accent}</span>
            ) : null}
            {heading.after}
          </h1>
          <p data-page-enter="" className="mt-5 max-w-[48ch] text-body-lg text-fg-muted">
            {totals.length > 0 ? (
              <>
                <b className="font-semibold text-fg-strong">{totals.join(", ")} pelatihan.</b>{" "}
              </>
            ) : null}
            {header.lead}
          </p>
        </div>
        <div className="lg:col-span-5">
          {/* q dibaca dari URL di klien; kerangka form tampil dulu tanpa nilai. */}
          <Suspense fallback={<CategorySearchForm />}>
            <CategorySearch />
          </Suspense>
          {examples.length > 0 ? (
            <div className="mt-3.5 flex flex-wrap items-center gap-2 text-small text-fg-muted">
              <span>Unggulan lain:</span>
              {examples.map((category) => (
                <ChipLink
                  key={category.slug}
                  href={`/pelatihan/kategori/${category.slug}`}
                  active={false}
                  scroll
                  className="h-9 px-3.5"
                >
                  {category.name}
                </ChipLink>
              ))}
            </div>
          ) : null}
          {/* Kotak ini hanya mencari nama kategori; judul pelatihan lewat command palette. */}
          <OpenSearchHint className="mt-4" />
        </div>
      </Container>
    </section>
  );
}

// Kepala section: eyebrow bernomor + h2 di kiri, keterangan singkat di kanan (opsional).
function SectionHead({
  id,
  index,
  eyebrow,
  title,
  aside,
}: {
  id: string;
  index: string;
  eyebrow: string;
  title: string;
  aside?: string;
}) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div>
        <Eyebrow index={index}>{eyebrow}</Eyebrow>
        <h2 id={id} className="mt-3 text-h2 text-fg-strong">
          {title}
        </h2>
      </div>
      {aside ? <p className="max-w-[40ch] text-body text-fg-muted">{aside}</p> : null}
    </div>
  );
}

async function CategoryResults({
  searchParams,
  letterCounts,
}: {
  searchParams: PageProps<"/pelatihan">["searchParams"];
  letterCounts: Record<string, number>;
}) {
  const requested = parseGridState(await searchParams);
  const { items, meta } = await getCategoryGrid(requested.q, requested.huruf, requested.page);
  const state = { ...requested, page: meta.page };
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
      {/* Toolbar (mockup): garis atas tegas, indeks huruf di kiri (scroll ke samping), jumlah di kanan. */}
      <div className="mb-7 flex items-center justify-between gap-4 border-t border-b border-t-fg-strong border-b-border py-3.5">
        <CategoryLetterIndex counts={letterCounts} active={state.huruf} className="flex-1" />
        <p role="status" className="shrink-0 font-mono text-label font-medium uppercase tracking-[0.08em] text-fg-muted">
          {formatNumber(meta.total)} {state.q ? "kategori cocok" : "kategori"}
          {state.huruf ? (
            <span className="max-sm:sr-only">{` / ${state.huruf === "#" ? "angka & simbol" : `huruf ${state.huruf}`}`}</span>
          ) : null}
        </p>
      </div>
      {state.q ? (
        <p className="-mt-3 mb-7 text-small text-fg-muted">
          Hasil untuk “{state.q}” ·{" "}
          <Link
            href="/pelatihan"
            scroll={false}
            className="rounded-sm text-link underline underline-offset-4 outline-none hover:text-fg-strong focus-visible:ring-2 focus-visible:ring-focus"
          >
            Hapus pencarian
          </Link>
        </p>
      ) : null}

      {items.length > 0 ? (
        <CategoryGrid categories={items} />
      ) : (
        <div className="rounded-card border border-dashed border-border-strong px-6 py-16 text-center">
          <p className="font-mono text-label uppercase tracking-[0.08em] text-fg-muted">0 hasil</p>
          <p className="mt-3 text-h3 text-fg-strong">
            {state.q
              ? `Kategori “${state.q}” tidak ditemukan`
              : state.huruf
                ? `Belum ada kategori berawalan ${state.huruf}.`
                : "Belum ada kategori."}
          </p>
          {state.huruf ? (
            <Link href="/pelatihan" scroll={false} className={cn(buttonVariants({ variant: "secondary" }), "mt-6")}>
              Lihat semua kategori
            </Link>
          ) : null}
          {state.q ? (
            <>
              <p className="mx-auto mt-2 max-w-[65ch] text-body text-fg-muted">
                Coba nama lain, atau cari langsung judul pelatihannya.
              </p>
              <div className="mt-6 flex flex-col items-center gap-4">
                <OpenSearchHint />
                <Link href="/pelatihan" scroll={false} className={buttonVariants({ variant: "secondary" })}>
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
          hrefFor={(page) => `${gridHref({ ...state, page })}#${GRID_ANCHOR}`}
          info={`Halaman ${meta.page} dari ${meta.totalPages} / ${from}-${to} dari ${formatNumber(meta.total)}`}
        />
      </div>
    </>
  );
}

// CTA penutup (DESIGN.md 8.9, palet D; bentuk kotak berbingkai dari mockup): permukaan biru
// (data-surface="secondary") + GrainOverlay + OutlineText (maks 2 elemen grafis, bisa dimatikan lewat
// setting decor), teks --on-secondary, tombol mustard + tombol garis terang. Teks & tombol dari setting
// trainings.page.cta; field kosong (atau pasangan label/tautan kosong) = bawaan.
function ClosingCta({ cta }: { cta: TrainingsPage["cta"] }) {
  const primary = { label: cta.primaryLabel, href: cta.primaryHref };
  const secondary = { label: cta.secondaryLabel, href: cta.secondaryHref };
  return (
    <section aria-labelledby="pelatihan-cta" className="py-24 md:py-28">
      <Container>
        <div
          data-surface="secondary"
          className="relative isolate grid grid-cols-1 gap-8 overflow-hidden rounded-card bg-inverse-bg px-6 py-10 text-inverse-fg md:px-14 md:py-16 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-end"
        >
          {cta.decor ? <GrainOverlay tone="inverse" /> : null}
          <OutlineText decor={cta.decor} tone="inverse" className="top-3 right-4 md:top-4 md:right-6">
            {cta.outline}
          </OutlineText>
          <div className="relative">
            <Eyebrow className="text-accent-on-dark">{cta.eyebrow}</Eyebrow>
            <h2 id="pelatihan-cta" className="mt-3 max-w-[18ch] text-h2 lg:text-[52px] lg:leading-[1.04]">
              {cta.heading}
            </h2>
            <p className="mt-4 max-w-[44ch] text-body-lg text-on-secondary">{cta.lead}</p>
          </div>
          <div className="relative flex flex-col gap-3 sm:flex-row sm:flex-wrap lg:justify-end">
            <Link href={primary.href} className={cn(buttonVariants({ variant: "inverse", size: "lg" }), "max-sm:w-full")}>
              {primary.label} <span aria-hidden className="ml-2">→</span>
            </Link>
            <Link href={secondary.href} className={cn(buttonVariants({ variant: "inverseOutline", size: "lg" }), "max-sm:w-full")}>
              {secondary.label}
            </Link>
          </div>
        </div>
      </Container>
    </section>
  );
}
