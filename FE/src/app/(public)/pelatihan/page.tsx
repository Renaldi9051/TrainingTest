import type { Metadata } from "next";
import { Suspense } from "react";
import { TrainingGridSkeleton } from "@/components/public/training-card";
import { Container } from "@/components/ui/container";
import { getSettings } from "@/lib/api/public";
import { catalogCanonical, parseCatalogState } from "@/lib/catalog-url";
import { Catalog } from "./catalog";

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
      <div className="relative flex min-h-56 items-center justify-center overflow-hidden bg-[#0b417f] text-white after:absolute after:inset-x-0 after:bottom-0 after:h-8 after:origin-bottom-left after:skew-y-[1.4deg] after:bg-white/40">
        <h1 data-page-enter="" className="relative z-10 px-4 text-center text-[30px] font-bold uppercase">Semua Pelatihan</h1>
      </div>
      <Container className="py-16 md:py-20">
      {/* Filter dibaca dari URL saat request, jadi bagian ini di-stream di dalam Suspense. */}
      <Suspense fallback={<CatalogSkeleton />}>
        <Catalog searchParams={searchParams} />
      </Suspense>
      </Container>
    </>
  );
}

function CatalogSkeleton() {
  return (
    <div className="mt-10 space-y-10">
      <div className="h-12 max-w-2xl bg-bg-muted" />
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="h-8 w-28 rounded-full bg-bg-muted" />
        ))}
      </div>
      <TrainingGridSkeleton />
    </div>
  );
}
