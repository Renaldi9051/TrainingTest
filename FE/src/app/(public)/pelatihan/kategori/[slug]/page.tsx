import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TrainingGrid } from "@/components/public/training-card";
import { Pagination } from "@/components/public/pagination";
import { Container } from "@/components/ui/container";
import { getCatalog, getCategory } from "@/lib/api/public";

// Paginasi kategori dibaca dari query string, sehingga rute dirender sesuai permintaan.
export const instant = false;
const LANDING_SIZE = 10;

export async function generateMetadata({ params }: PageProps<"/pelatihan/kategori/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategory(slug);
  if (!category) return { title: "Kategori tidak ditemukan" };
  return {
    title: `Pelatihan ${category.name}`,
    description: category.description ?? undefined,
    alternates: { canonical: `/pelatihan/kategori/${category.slug}` },
  };
}

export default async function CategoryPage({ params, searchParams }: PageProps<"/pelatihan/kategori/[slug]">) {
  const { slug } = await params;
  const rawPage = Number.parseInt((await searchParams).hal?.toString() ?? "1", 10);
  const page = Number.isFinite(rawPage) && rawPage > 1 ? Math.min(rawPage, 1000) : 1;
  const category = await getCategory(slug);
  if (!category) notFound();
  const catalog = await getCatalog({ kategori: [category.slug], hal: page, per: LANDING_SIZE });
  return (
    <>
      <div className="relative flex min-h-56 items-center justify-center overflow-hidden bg-[#0b417f] text-white after:absolute after:inset-x-0 after:bottom-0 after:h-8 after:origin-bottom-left after:skew-y-[1.4deg] after:bg-white/40">
        <h1 data-page-enter="" className="relative z-10 px-4 text-center text-[30px] font-bold">Category: {category.name}</h1>
      </div>
      <Container className="py-16 md:py-20">
        <div>
          {catalog.items.length > 0 ? (
            <TrainingGrid trainings={catalog.items} headingLevel="h2" variant="reference-category" />
          ) : (
            <div className="py-12">
              <p className="text-[24px] leading-[1.25] font-medium text-fg-strong">Belum ada pelatihan di kategori ini</p>
              <p className="mt-3 text-body text-fg-muted">Lihat kategori lain di katalog.</p>
            </div>
          )}
        </div>
        <div className="mt-10">
          <Pagination meta={catalog.meta} hrefFor={(number) => number === 1 ? `/pelatihan/kategori/${category.slug}` : `/pelatihan/kategori/${category.slug}?hal=${number}`} />
        </div>
      </Container>
    </>
  );
}
