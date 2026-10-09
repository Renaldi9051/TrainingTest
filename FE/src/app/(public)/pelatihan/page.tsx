import type { Metadata } from "next";
import { Suspense } from "react";
import { TrainingGridSkeleton } from "@/components/public/training-card";
import { Container } from "@/components/ui/container";
import { Eyebrow } from "@/components/ui/eyebrow";
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
    <Container className="py-16 md:py-24">
      <Eyebrow>Katalog</Eyebrow>
      <h1 className="mt-4 text-[36px] leading-[1.05] font-semibold tracking-[-0.03em] text-fg-strong md:text-[56px]">
        Pelatihan
      </h1>
      {/* Filter dibaca dari URL saat request, jadi bagian ini di-stream di dalam Suspense. */}
      <Suspense fallback={<CatalogSkeleton />}>
        <Catalog searchParams={searchParams} />
      </Suspense>
    </Container>
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
