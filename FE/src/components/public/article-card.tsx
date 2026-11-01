import Link from "next/link";
import { Viewfinder } from "@/components/decor/viewfinder";
import { RevealImage } from "@/components/motion/reveal-parts";
import { RevealRows } from "@/components/motion/reveal-rows";
import type { PublicArticleCard } from "@/lib/api/types";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CARD_IMAGE_SIZES } from "./training-card";
import { PublicImage } from "./public-image";

// Kartu artikel: pola sama dengan kartu pelatihan (DESIGN 8.4, palet D) supaya satu bahasa visual:
// radius 12 px ber-border, sampul 4:3 dengan grading film yang lepas saat hover/fokus, label kategori
// mono --secondary + tanggal, judul h3, ringkasan maks 3 baris. Seluruh kartu satu link.
// Tanpa sampul: blok --bg-muted dengan sudut Viewfinder (elemen UI, bukan foto pengganti).
export function ArticleCard({
  article,
  headingLevel = "h3",
}: {
  article: PublicArticleCard;
  headingLevel?: "h2" | "h3";
}) {
  const Heading = headingLevel;
  return (
    <article
      data-cursor-label=""
      className={cn(
        "group relative flex h-full flex-col rounded-card border border-border bg-bg pb-[18px]",
        "transition-[border-color,translate] ease-standard [transition-duration:150ms,300ms]",
        "hover:border-primary focus-within:border-primary motion-safe:hover:-translate-y-[3px]",
      )}
    >
      <RevealImage className="relative aspect-[4/3] overflow-hidden rounded-t-[calc(var(--card-radius,var(--radius))-1px)] bg-bg-muted">
        {article.cover ? (
          <>
            <PublicImage
              image={article.cover}
              sizes={CARD_IMAGE_SIZES}
              film
              className="transition-[transform,filter] duration-300 ease-standard group-hover:scale-[1.03] group-hover:filter-none group-focus-within:filter-none motion-reduce:transition-none motion-reduce:group-hover:scale-100"
            />
            <Viewfinder size="sm" tone="plain" hover />
          </>
        ) : (
          <Viewfinder size="sm" tone="mark" hover className="opacity-100" />
        )}
      </RevealImage>
      <p className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 px-[18px] font-mono text-label uppercase tracking-[0.08em]">
        {article.category ? <span className="text-secondary">{article.category.name}</span> : null}
        <time dateTime={article.publishedAt} className="text-fg-muted">
          {formatDate(article.publishedAt)}
        </time>
      </p>
      <Heading className="mt-2 px-[18px] text-h3 text-fg-strong">
        <Link
          href={`/artikel/${article.slug}`}
          className="underline-offset-4 outline-none group-hover:underline after:absolute after:inset-0 focus-visible:underline after:rounded-card focus-visible:after:ring-2 focus-visible:after:ring-focus focus-visible:after:ring-offset-4"
        >
          {article.title}
        </Link>
      </Heading>
      {article.excerpt ? (
        <p className="mt-3 line-clamp-3 px-[18px] text-small text-fg-muted">{article.excerpt}</p>
      ) : null}
    </article>
  );
}

// headingLevel: h2 kalau grid langsung di bawah h1 halaman, h3 di bawah judul section.
export function ArticleGrid({
  articles,
  headingLevel = "h3",
}: {
  articles: PublicArticleCard[];
  headingLevel?: "h2" | "h3";
}) {
  return (
    <RevealRows as="ul" kind="card" className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
      {articles.map((article) => (
        <li key={article.slug}>
          <ArticleCard article={article} headingLevel={headingLevel} />
        </li>
      ))}
    </RevealRows>
  );
}

export function ArticleGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div role="status" aria-label="Memuat artikel" className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="space-y-4 rounded-card border border-border pb-6">
          <div className="aspect-[4/3] rounded-t-card bg-bg-muted" />
          <div className="mx-[18px] h-3 w-32 bg-bg-muted" />
          <div className="mx-[18px] h-6 w-4/5 bg-bg-muted" />
          <div className="mx-[18px] h-4 w-2/3 bg-bg-muted" />
        </div>
      ))}
      <span className="sr-only">Memuat artikel...</span>
    </div>
  );
}
