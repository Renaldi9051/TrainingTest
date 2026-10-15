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
      {/* Pencarian & urutan dibaca dari URL saat request, jadi bagian ini di-stream di dalam Suspense. */}
      <Suspense fallback={<CatalogSkeleton />}>
        <Catalog searchParams={searchParams} />
      </Suspense>
      </Container>
    </>
  );
}

function CatalogSkeleton() {
  return (
    <div className="space-y-10">
      <div className="h-6 max-w-xs bg-bg-muted" />
      <TrainingGridSkeleton />
    </div>
  );
}
