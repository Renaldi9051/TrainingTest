import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";
import { Viewfinder } from "@/components/decor/viewfinder";
import { RevealImage } from "@/components/motion/reveal-parts";
import { RevealRows } from "@/components/motion/reveal-rows";
import type { PublicCategoryGridItem } from "@/lib/api/types";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PublicImage } from "./public-image";

// Mobile: thumbnail 96 px di baris daftar; sm 2 kolom, lg 3, xl 4 (container 1280 px).
export const CATEGORY_CARD_SIZES = "(min-width: 1280px) 300px, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 96px";
// Kartu di layar pertama dimuat langsung, sisanya lazy.
const EAGER_CARDS = 4;

const GRID_CLASS = "grid grid-cols-1 sm:grid-cols-2 sm:gap-x-5 sm:gap-y-8 lg:grid-cols-3 xl:grid-cols-4";

// Huruf pertama nama untuk kotak tanpa cover ("K3 Umum" -> "K").
export function categoryInitial(name: string): string {
  return (name.match(/[\p{L}\p{N}]/u)?.[0] ?? "#").toLocaleUpperCase("id-ID");
}

// Kartu kategori grid A-Z /pelatihan (mockup redesign 5 Nov 2026, palet D): tanpa kotak; foto 3:2
// radius 12 dengan grading film, di bawahnya nama 18 px + "[N] judul pelatihan" --fg-muted dan panah
// --secondary. Mobile (< 640 px): baris daftar (thumbnail 96 px 4:3 kiri, garis pemisah), supaya
// 24 kartu tidak jadi halaman sangat panjang.
// Seluruh kartu satu tautan ke landing kategori. Hover/fokus: kartu naik 3 px (sm ke atas), foto zoom
// 1.03, sudut Viewfinder masuk, judul bergaris bawah, panah bergeser. Cover kosong: blok --bg-muted
// berisi huruf awal outline --primary-ink.
export function CategoryCard({ category, eager = false }: { category: PublicCategoryGridItem; eager?: boolean }) {
  return (
    <Link
      href={`/pelatihan/kategori/${category.slug}`}
      data-category-card={category.slug}
      className={cn(
        "group flex h-full flex-row items-center gap-3.5 py-3 outline-none sm:flex-col sm:items-stretch sm:gap-0 sm:py-0",
        "rounded-md sm:rounded-card motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-standard sm:motion-safe:hover:-translate-y-[3px]",
        "focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-4",
      )}
    >
      <RevealImage className="relative aspect-[4/3] w-24 shrink-0 overflow-hidden rounded-md bg-bg-muted sm:aspect-[3/2] sm:w-full sm:rounded-card">
        {category.cover ? (
          <>
            <PublicImage
              image={category.cover}
              sizes={CATEGORY_CARD_SIZES}
              film
              priority={eager}
              className="transition-transform duration-500 ease-standard group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
            />
            <Viewfinder size="sm" tone="plain" hover className="max-sm:hidden" />
          </>
        ) : (
          <div aria-hidden className="absolute inset-0 flex items-end p-2 sm:p-4">
            <Viewfinder size="sm" tone="mark" hover className="max-sm:hidden" />
            <span className="text-[34px] leading-[0.8] font-[700] tracking-[-0.04em] text-transparent [-webkit-text-stroke:1.5px_var(--primary-ink,var(--fg-strong))] sm:text-[64px]">
              {categoryInitial(category.name)}
            </span>
          </div>
        )}
      </RevealImage>
      <div className="flex min-w-0 flex-1 items-center justify-between gap-3 sm:items-start sm:px-0.5 sm:pt-3.5">
        <div className="min-w-0">
          <h3 className="text-[16px] leading-[1.3] font-medium tracking-[-0.01em] text-fg-strong underline-offset-4 decoration-1 group-hover:underline group-focus-visible:underline sm:text-[18px]">
            {category.name}
          </h3>
          <p className="mt-1 text-small text-fg-muted">{formatNumber(category.trainingCount)} judul pelatihan</p>
        </div>
        <ArrowRightIcon
          aria-hidden
          strokeWidth={1.5}
          className="size-[18px] shrink-0 text-link transition-transform duration-150 ease-standard group-hover:translate-x-[3px] motion-reduce:transition-none sm:mt-0.5"
        />
      </div>
    </Link>
  );
}

export function CategoryGrid({ categories, eagerCount = EAGER_CARDS }: { categories: PublicCategoryGridItem[]; eagerCount?: number }) {
  return (
    <RevealRows as="ul" kind="card" className={GRID_CLASS}>
      {categories.map((category, index) => (
        <li key={category.slug} className="border-b border-border sm:border-b-0">
          <CategoryCard category={category} eager={index < eagerCount} />
        </li>
      ))}
    </RevealRows>
  );
}

export function CategoryGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div role="status" aria-label="Memuat kategori" className={GRID_CLASS}>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="flex flex-row items-center gap-3.5 border-b border-border py-3 sm:flex-col sm:items-stretch sm:gap-0 sm:border-b-0 sm:py-0">
          <div className="aspect-[4/3] w-24 shrink-0 rounded-md bg-bg-muted sm:aspect-[3/2] sm:w-full sm:rounded-card" />
          <div className="flex-1 space-y-2 sm:pt-3.5">
            <div className="h-5 w-3/4 bg-bg-muted" />
            <div className="h-4 w-1/3 bg-bg-muted" />
          </div>
        </div>
      ))}
      <span className="sr-only">Memuat kategori...</span>
    </div>
  );
}
