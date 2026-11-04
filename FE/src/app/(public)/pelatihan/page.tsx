import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";
import { Suspense } from "react";
import { TrainingGridSkeleton } from "@/components/public/training-card";
import { PageHero } from "@/components/public/page-hero";
import { Container } from "@/components/ui/container";
import { getCategory, getRedirect, getSettings, Tag } from "@/lib/api/public";
import { catalogCanonical, parseCatalogState } from "@/lib/catalog-url";
import { followRedirect } from "@/lib/public-redirect";
import { Catalog, CatalogSearch } from "./catalog";

export async function generateMetadata({ searchParams }: PageProps<"/pelatihan">): Promise<Metadata> {
  const [settings, state] = await Promise.all([getSettings(), searchParams.then(parseCatalogState)]);
  return {
    title: "Katalog pelatihan",
    description: settings.seo.description || undefined,
    // Hasil filter/search tidak diindeks terpisah (lihat catalogCanonical).
    alternates: { canonical: catalogCanonical(state) },
  };
}

// Kategori tidak lagi memfilter katalog (keputusan atasan 4 Nov 2026): semua tautan kategori menuju
// halaman kategori v2. /pelatihan?kategori=<slug> dialihkan 308 ke /pelatihan/kategori/<slug>
// (parameter lain dibuang; >1 kategori ambil yang pertama). Slug tak dikenal: hormati tabel Redirect
// (slug lama), lalu 308 ke /pelatihan. Dilakukan di server sebelum render.
async function redirectCategoryParam(searchParams: PageProps<"/pelatihan">["searchParams"]): Promise<void> {
  const slug = parseCatalogState(await searchParams).kategori[0];
  if (!slug) return;
  const landing = `/pelatihan/kategori/${slug}`;
  if (await getCategory(slug)) permanentRedirect(landing);
  // Slug tak dikenal: ikuti redirect slug lama kalau ada, selain itu kembali ke katalog.
  const target = await getRedirect(landing, Tag.category(slug));
  if (target) followRedirect(target);
  permanentRedirect("/pelatihan");
}

export default async function CatalogPage({ searchParams }: PageProps<"/pelatihan">) {
  await redirectCategoryParam(searchParams);
  return (
    <>
      <PageHero
        crumbs={[{ label: "Pelatihan" }]}
        title="Katalog pelatihan"
        lead="Cari berdasarkan judul, atau saring per metode dan tipe kelas. Pilih kategori untuk membuka halamannya."
        dots
        aside={
          // Nilai q dibaca dari URL saat request; kerangka form tampil dulu tanpa nilai.
          <Suspense fallback={<CatalogSearch />}>
            <HeroSearch searchParams={searchParams} />
          </Suspense>
        }
      />
      <Container className="pt-12 pb-24 md:pb-32">
        {/* Filter dibaca dari URL saat request, jadi bagian ini di-stream di dalam Suspense. */}
        <Suspense fallback={<CatalogSkeleton />}>
          <Catalog searchParams={searchParams} />
        </Suspense>
      </Container>
    </>
  );
}

async function HeroSearch({ searchParams }: { searchParams: PageProps<"/pelatihan">["searchParams"] }) {
  return <CatalogSearch state={parseCatalogState(await searchParams)} />;
}

function CatalogSkeleton() {
  return (
    <div className="grid gap-8 lg:grid-cols-12 lg:gap-6">
      <div className="hidden space-y-3 lg:col-span-3 lg:block">
        {Array.from({ length: 9 }, (_, index) => (
          <div key={index} className="h-6 bg-bg-muted" />
        ))}
      </div>
      <div className="lg:col-span-9">
        <div className="mb-8 h-8 border-b border-border" />
        <TrainingGridSkeleton narrow />
      </div>
    </div>
  );
}
