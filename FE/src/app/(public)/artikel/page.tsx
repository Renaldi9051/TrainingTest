import { NewspaperIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ActiveIndicator } from "@/components/motion/active-indicator";
import { ArticleGrid, ArticleGridSkeleton } from "@/components/public/article-card";
import { ChipLink } from "@/components/public/chip-link";
import { PageHero } from "@/components/public/page-hero";
import { Pagination } from "@/components/public/pagination";
import { buttonVariants } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { getArticleCategories, getArticles, getSettings } from "@/lib/api/public";
import { articleListHref, parseArticleListState } from "@/lib/article-url";
import { formatNumber } from "@/lib/format";

export async function generateMetadata({ searchParams }: PageProps<"/artikel">): Promise<Metadata> {
  const [settings, state] = await Promise.all([getSettings(), searchParams.then(parseArticleListState)]);
  return {
    title: "Artikel",
    description: settings.seo.description || undefined,
    // Halaman filter/paginasi tidak diindeks terpisah.
    alternates: { canonical: state.kategori || state.hal > 1 ? "/artikel" : undefined },
  };
}

export default function ArticlesPage({ searchParams }: PageProps<"/artikel">) {
  return (
    <>
      <PageHero
        crumbs={[{ label: "Artikel" }]}
        title="Berita & artikel"
        lead="Kabar terbaru, regulasi, dan wawasan seputar pelatihan dan teknologi."
      />
      <Container className="pt-12 pb-24 md:pb-32">
        {/* Filter & halaman dibaca dari URL saat request, jadi bagian ini di-stream di dalam Suspense. */}
        <Suspense fallback={<ArticleGridSkeleton />}>
          <ArticleList searchParams={searchParams} />
        </Suspense>
      </Container>
    </>
  );
}

async function ArticleList({ searchParams }: { searchParams: PageProps<"/artikel">["searchParams"] }) {
  const state = parseArticleListState(await searchParams);
  const [{ items, meta }, categories] = await Promise.all([
    getArticles({ kategori: state.kategori ?? undefined, hal: state.hal }),
    getArticleCategories(),
  ]);
  const activeCategory = categories.find((category) => category.slug === state.kategori) ?? null;

  return (
    <div className="space-y-10">
      {categories.length > 1 ? (
        <nav aria-label="Kategori artikel">
          <ActiveIndicator variant="pill" className="flex flex-wrap gap-2">
            <ChipLink href={articleListHref(state, { kategori: null })} active={!state.kategori}>
              Semua
            </ChipLink>
            {categories.map((category) => (
              <ChipLink
                key={category.slug}
                href={articleListHref(state, { kategori: category.slug })}
                active={state.kategori === category.slug}
              >
                {category.name}
              </ChipLink>
            ))}
          </ActiveIndicator>
        </nav>
      ) : null}

      <p className="font-mono text-label uppercase tracking-[0.08em] text-fg-muted" aria-live="polite">
        {formatNumber(meta.total)} artikel{activeCategory ? ` / ${activeCategory.name}` : ""}
      </p>

      {items.length > 0 ? (
        <ArticleGrid articles={items} headingLevel="h2" />
      ) : (
        <div className="flex flex-col items-start gap-4 border-y border-border py-16">
          <NewspaperIcon className="size-6 text-fg-muted" strokeWidth={1.5} aria-hidden />
          <p className="text-h3 text-fg-strong">
            {state.kategori || state.hal > 1 ? "Tidak ada artikel di sini" : "Belum ada artikel"}
          </p>
          <p className="max-w-[65ch] text-body text-fg-muted">
            {state.kategori || state.hal > 1
              ? "Coba kategori lain atau kembali ke semua artikel."
              : "Artikel baru akan tampil di halaman ini."}
          </p>
          {state.kategori || state.hal > 1 ? (
            <Link href="/artikel" className={buttonVariants({ variant: "secondary" })}>
              Lihat semua artikel
            </Link>
          ) : null}
        </div>
      )}

      <Pagination meta={meta} hrefFor={(page) => articleListHref(state, { hal: page })} />
    </div>
  );
}
