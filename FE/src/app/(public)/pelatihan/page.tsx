import type { Metadata } from "next";
import { Suspense } from "react";
import { TrainingGridSkeleton } from "@/components/public/training-card";
import { PageHero } from "@/components/public/page-hero";
import { Container } from "@/components/ui/container";
import { getSettings } from "@/lib/api/public";
import { catalogCanonical, parseCatalogState } from "@/lib/catalog-url";
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

export default function CatalogPage({ searchParams }: PageProps<"/pelatihan">) {
  return (
    <>
      <PageHero
        crumbs={[{ label: "Pelatihan" }]}
        title="Katalog pelatihan"
        lead="Cari berdasarkan judul, atau saring per kategori, metode, dan tipe kelas."
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
