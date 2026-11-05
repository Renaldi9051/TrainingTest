import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";
import { Viewfinder } from "@/components/decor/viewfinder";
import { RevealImage } from "@/components/motion/reveal-parts";
import { RevealRows } from "@/components/motion/reveal-rows";
import type { PublicCategoryGridItem } from "@/lib/api/types";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PublicImage } from "./public-image";

// Grid auto-fill minmax(260px, 1fr) di container 1280 px: 4 kolom di desktop lebar, 2-3 di tablet.
export const CATEGORY_CARD_SIZES = "(min-width: 1280px) 300px, (min-width: 1024px) 33vw, (min-width: 600px) 50vw, 100vw";
// Kartu di layar pertama dimuat langsung (LCP), sisanya lazy.
const EAGER_CARDS = 6;

// Inisial untuk kartu tanpa cover: huruf/angka pertama dua kata pertama ("K3 Umum" -> "KU").
export function categoryInitials(name: string): string {
  const words = name.match(/[\p{L}\p{N}][\p{L}\p{N}]*/gu) ?? [];
  return words
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toLocaleUpperCase("id-ID");
}

// Kartu kategori /pelatihan (palet D): radius 12, border --border, latar --bg; cover 4:3 dengan
// grading film, badge mustard "Unggulan", label mono "[X] pelatihan" --secondary, nama 20 px, panah.
// Seluruh kartu satu tautan ke halaman kategori v2. Hover/fokus: border --primary + naik 3 px,
// foto zoom 1.03, sudut Viewfinder masuk. Cover kosong: blok --bg-muted berisi inisial + nama.
export function CategoryCard({ category, eager = false }: { category: PublicCategoryGridItem; eager?: boolean }) {
  return (
    <Link
      href={`/pelatihan/kategori/${category.slug}`}
      data-category-card={category.slug}
      className={cn(
        "group relative flex h-full flex-col rounded-card border border-border bg-bg outline-none",
        "transition-[border-color,translate] ease-standard [transition-duration:150ms,300ms]",
        "hover:border-primary focus-visible:border-primary motion-safe:hover:-translate-y-[3px]",
        "focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-4",
      )}
    >
      <RevealImage className="relative aspect-[4/3] overflow-hidden rounded-t-[calc(var(--card-radius,var(--radius))-1px)] bg-bg-muted">
        {category.cover ? (
          <>
            <PublicImage
              image={category.cover}
              sizes={CATEGORY_CARD_SIZES}
              film
              priority={eager}
              className="transition-transform duration-300 ease-standard group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
            />
            <Viewfinder size="sm" tone="plain" hover />
          </>
        ) : (
          <div aria-hidden className="absolute inset-0 flex flex-col justify-between p-6">
            <Viewfinder size="sm" tone="mark" hover className="opacity-100" />
            <span className="font-mono text-[44px] leading-none font-medium tracking-[-0.02em] text-fg-muted">
              {categoryInitials(category.name)}
            </span>
            <span className="line-clamp-2 font-mono text-label font-medium uppercase tracking-[0.08em] text-fg-muted">
              {category.name}
            </span>
          </div>
        )}
        {category.featured ? (
          <span className="absolute top-3 left-3 rounded-full bg-accent px-3 py-1 font-mono text-label font-medium uppercase tracking-[0.08em] text-on-accent">
            Unggulan
          </span>
        ) : null}
      </RevealImage>
      <div className="flex flex-1 flex-col px-[18px] pt-4 pb-[18px]">
        <p className="font-mono text-label uppercase tracking-[0.08em] text-secondary">
          {formatNumber(category.trainingCount)} pelatihan
        </p>
        <div className="mt-2 flex flex-1 items-start justify-between gap-3">
          <h2 className="text-[20px] leading-[1.25] font-medium text-fg-strong underline-offset-4 group-hover:underline group-focus-visible:underline">
            {category.name}
          </h2>
          <ArrowRightIcon
            aria-hidden
            strokeWidth={1.5}
            className="mt-1 size-5 shrink-0 text-primary-ink transition-transform duration-150 ease-standard group-hover:translate-x-1 motion-reduce:transition-none"
          />
        </div>
      </div>
    </Link>
  );
}

export function CategoryGrid({ categories }: { categories: PublicCategoryGridItem[] }) {
  return (
    <RevealRows as="ul" kind="card" className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-5">
      {categories.map((category, index) => (
        <li key={category.slug}>
          <CategoryCard category={category} eager={index < EAGER_CARDS} />
        </li>
      ))}
    </RevealRows>
  );
}

export function CategoryGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div role="status" aria-label="Memuat kategori" className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-5">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="rounded-card border border-border">
          <div className="aspect-[4/3] rounded-t-card bg-bg-muted" />
          <div className="space-y-3 p-[18px]">
            <div className="h-3 w-24 bg-bg-muted" />
            <div className="h-5 w-3/4 bg-bg-muted" />
          </div>
        </div>
      ))}
      <span className="sr-only">Memuat kategori...</span>
    </div>
  );
}
