import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TrainingGrid } from "@/components/public/training-card";
import { ButtonArrow, buttonVariants } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Eyebrow } from "@/components/ui/eyebrow";
import { getCatalog, getCategories, getCategory } from "@/lib/api/public";
import { formatNumber } from "@/lib/format";

// Landing kategori statis (opsi A): deskripsi + 24 pelatihan terbaru. Filter & paginasi lengkap
// ada di /pelatihan?kategori=<slug>. Statis penuh supaya slug tak dikenal = HTTP 404 sungguhan.
export const ensureStatic = "navigation";
export const instant = false;

const BUILD_PLACEHOLDER = "__placeholder";
const LANDING_SIZE = 24;

export async function generateStaticParams() {
  try {
    const categories = await getCategories();
    const slugs = categories.filter((category) => category.trainingCount > 0).map((category) => category.slug);
    if (slugs.length > 0) return slugs.map((slug) => ({ slug }));
  } catch {
    // BE tidak terjangkau saat build: halaman dibuat saat diminta pertama kali.
  }
  return [{ slug: BUILD_PLACEHOLDER }];
}

async function loadCategory(slug: string) {
  return slug === BUILD_PLACEHOLDER ? null : getCategory(slug);
}

export async function generateMetadata({ params }: PageProps<"/pelatihan/kategori/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const category = await loadCategory(slug);
  if (!category) return { title: "Kategori tidak ditemukan" };
  return {
    title: `Pelatihan ${category.name}`,
    description: category.description ?? undefined,
    alternates: { canonical: `/pelatihan/kategori/${category.slug}` },
  };
}

export default async function CategoryPage({ params }: PageProps<"/pelatihan/kategori/[slug]">) {
  const { slug } = await params;
  const category = await loadCategory(slug);
  if (!category) notFound();
  const catalog = await getCatalog({ kategori: [category.slug], per: LANDING_SIZE });
  const filteredHref = `/pelatihan?kategori=${category.slug}`;

  return (
    <Container className="py-16 md:py-24">
      <nav aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-2 font-mono text-label uppercase tracking-[0.08em] text-fg-muted">
          <li>
            <Link href="/pelatihan" className="underline-offset-4 hover:text-fg-strong hover:underline">
              Pelatihan
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li aria-current="page">Kategori</li>
        </ol>
      </nav>
      <div className="mt-8 grid gap-8 border-b border-border pb-12 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <h1 className="text-[36px] leading-[1.05] font-semibold tracking-[-0.03em] text-fg-strong md:text-[56px]">
            {category.name}
          </h1>
          {category.description ? (
            <p className="mt-6 max-w-[65ch] text-body-lg text-fg-muted">{category.description}</p>
          ) : null}
        </div>
        <div className="flex flex-col justify-end gap-2 lg:col-span-4 lg:items-end">
          <Eyebrow>Jumlah pelatihan</Eyebrow>
          <p className="font-mono text-[40px] leading-none text-fg-strong">{formatNumber(category.trainingCount)}</p>
        </div>
      </div>

      <div className="mt-12">
        {catalog.items.length > 0 ? (
          <TrainingGrid trainings={catalog.items} />
        ) : (
          <div className="py-12">
            <p className="text-[24px] leading-[1.25] font-medium text-fg-strong">Belum ada pelatihan di kategori ini</p>
            <p className="mt-3 text-body text-fg-muted">Lihat kategori lain di katalog.</p>
          </div>
        )}
      </div>

      <div className="mt-12 flex flex-wrap items-center gap-6 border-t border-border pt-8">
        {catalog.meta.total > catalog.items.length ? (
          <Link href={filteredHref} className={buttonVariants({ variant: "primary", size: "lg" })}>
            Lihat semua {formatNumber(catalog.meta.total)} pelatihan
            <ButtonArrow />
          </Link>
        ) : null}
        <Link href={filteredHref} className={`${buttonVariants({ variant: "ghost" })} gap-2`}>
          Cari dan saring di kategori ini
          <ButtonArrow />
        </Link>
      </div>
    </Container>
  );
}
