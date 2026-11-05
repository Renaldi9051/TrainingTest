import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";
import { Viewfinder } from "@/components/decor/viewfinder";
import { RevealImage } from "@/components/motion/reveal-parts";
import { RevealRows } from "@/components/motion/reveal-rows";
import type { PublicCategoryGridItem } from "@/lib/api/types";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PublicImage } from "./public-image";

// Mobile: thumbnail 40% lebar baris; sm ke atas grid auto-fill minmax(260px, 1fr) di container
// 1280 px: 4 kolom di desktop lebar, 2-3 di tablet.
export const CATEGORY_CARD_SIZES = "(min-width: 1280px) 300px, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 40vw";
// Kartu di layar pertama dimuat langsung (LCP), sisanya lazy.
const EAGER_CARDS = 6;

const GRID_CLASS = "grid grid-cols-1 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(260px,1fr))] sm:gap-5";

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
// grading film, label mono "[X] pelatihan" --secondary + nomor urut mono, nama 20 px, panah.
// Unggulan tidak berbadge per kartu: grid dikelompokkan (CategoryGroups).
// Mobile (< 640 px): baris ringkas (thumbnail kiri, teks kanan) supaya 24 kartu tidak jadi halaman
// sepanjang 10.000 px; sm ke atas kartu tegak.
// Seluruh kartu satu tautan ke halaman kategori v2. Hover/fokus: border --primary + naik 3 px,
// foto zoom 1.03, sudut Viewfinder masuk. Cover kosong: blok --bg-muted berisi inisial + nama.
export function CategoryCard({
  category,
  position,
  eager = false,
}: {
  category: PublicCategoryGridItem;
  // Posisi global di daftar (1-based), tampil sebagai "001".
  position?: number;
  eager?: boolean;
}) {
  return (
    <Link
      href={`/pelatihan/kategori/${category.slug}`}
      data-category-card={category.slug}
      data-featured={category.featured ? "" : undefined}
      className={cn(
        "group relative flex h-full flex-row rounded-card border border-border bg-bg outline-none sm:flex-col",
        "transition-[border-color,translate] ease-standard [transition-duration:150ms,300ms]",
        "hover:border-primary focus-visible:border-primary motion-safe:hover:-translate-y-[3px]",
        "focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-4",
      )}
    >
      <RevealImage
        className={cn(
          "relative aspect-[4/3] w-[40%] shrink-0 self-start overflow-hidden bg-bg-muted sm:w-full",
          // Ditulis utuh (bukan template string) supaya terbaca pemindai Tailwind.
          "rounded-l-[calc(var(--card-radius,var(--radius))-1px)] sm:rounded-l-none sm:rounded-t-[calc(var(--card-radius,var(--radius))-1px)]",
        )}
      >
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
          <div aria-hidden className="absolute inset-0 flex flex-col justify-between p-3 sm:p-6">
            <Viewfinder size="sm" tone="mark" hover className="opacity-100" />
            <span className="font-mono text-[28px] leading-none font-medium tracking-[-0.02em] text-fg-muted sm:text-[44px]">
              {categoryInitials(category.name)}
            </span>
            <span className="line-clamp-2 font-mono text-label font-medium uppercase tracking-[0.08em] text-fg-muted max-sm:hidden">
              {category.name}
            </span>
          </div>
        )}
      </RevealImage>
      <div className="flex min-w-0 flex-1 flex-col justify-center px-4 py-3 sm:justify-start sm:px-[18px] sm:pt-4 sm:pb-[18px]">
        <p className="flex items-center justify-between gap-3 font-mono text-label uppercase tracking-[0.08em]">
          <span className="text-secondary">{formatNumber(category.trainingCount)} pelatihan</span>
          {position ? (
            <span aria-hidden className="text-fg-muted">
              {String(position).padStart(3, "0")}
            </span>
          ) : null}
        </p>
        <div className="mt-1.5 flex items-start justify-between gap-3 sm:mt-2 sm:flex-1">
          <h3 className="text-[17px] leading-[1.25] font-medium text-fg-strong underline-offset-4 group-hover:underline group-focus-visible:underline sm:text-[20px]">
            {category.name}
          </h3>
          <ArrowRightIcon
            aria-hidden
            strokeWidth={1.5}
            className="mt-0.5 size-5 shrink-0 text-primary-ink transition-transform duration-150 ease-standard group-hover:translate-x-1 motion-reduce:transition-none sm:mt-1"
          />
        </div>
      </div>
    </Link>
  );
}

// offset: posisi global kartu pertama dikurangi 1 (untuk nomor urut "001").
export function CategoryGrid({
  categories,
  offset = 0,
  eagerCount = EAGER_CARDS,
}: {
  categories: PublicCategoryGridItem[];
  offset?: number;
  eagerCount?: number;
}) {
  return (
    <RevealRows as="ul" kind="card" className={GRID_CLASS}>
      {categories.map((category, index) => (
        <li key={category.slug}>
          <CategoryCard category={category} position={offset + index + 1} eager={index < eagerCount} />
        </li>
      ))}
    </RevealRows>
  );
}

// Grid dikelompokkan: BE mengurutkan unggulan dulu lalu A-Z, jadi satu halaman berisi paling banyak
// dua kelompok berurutan. Tiap kelompok punya label mono + judul (h2) + jumlah; kelompok kosong tidak
// dirender. Menggantikan badge "Unggulan" per kartu (dengan banyak unggulan, beberapa halaman pertama
// penuh badge yang sama sehingga tidak lagi membedakan apa-apa).
export function CategoryGroups({
  categories,
  offset,
  featuredTotal,
}: {
  categories: PublicCategoryGridItem[];
  offset: number;
  // Jumlah unggulan di seluruh daftar; null = tidak ditampilkan (mis. saat mencari).
  featuredTotal: number | null;
}) {
  const featured = categories.filter((category) => category.featured);
  const others = categories.filter((category) => !category.featured);
  const groups = [
    { id: "unggulan", label: "Unggulan", title: "Kategori unggulan", items: featured, start: offset, count: featuredTotal },
    {
      id: "lainnya",
      label: "A-Z",
      title: featured.length > 0 ? "Kategori lainnya" : "Semua kategori",
      items: others,
      start: offset + featured.length,
      count: null,
    },
  ].filter((group) => group.items.length > 0);

  return (
    <div className="space-y-14 md:space-y-16">
      {groups.map((group, groupIndex) => (
        <section key={group.id} aria-labelledby={`kategori-${group.id}`} data-category-group={group.id}>
          <div className="mb-5 flex items-end justify-between gap-4 md:mb-6">
            <div>
              <p className="font-mono text-label font-medium uppercase tracking-[0.08em] text-primary-ink">{group.label}</p>
              <h2 id={`kategori-${group.id}`} className="mt-1.5 text-h3 text-fg-strong">
                {group.title}
              </h2>
            </div>
            {group.count !== null ? (
              <p className="shrink-0 font-mono text-label uppercase tracking-[0.08em] text-fg-muted">
                {formatNumber(group.count)} kategori
              </p>
            ) : null}
          </div>
          <CategoryGrid
            categories={group.items}
            offset={group.start}
            eagerCount={groupIndex === 0 ? EAGER_CARDS : Math.max(0, EAGER_CARDS - groups[0].items.length)}
          />
        </section>
      ))}
    </div>
  );
}

export function CategoryGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div role="status" aria-label="Memuat kategori" className={GRID_CLASS}>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="flex flex-row rounded-card border border-border sm:flex-col">
          <div className="aspect-[4/3] w-[40%] shrink-0 rounded-l-card bg-bg-muted sm:w-full sm:rounded-l-none sm:rounded-t-card" />
          <div className="flex-1 space-y-3 p-4 sm:p-[18px]">
            <div className="h-3 w-24 bg-bg-muted" />
            <div className="h-5 w-3/4 bg-bg-muted" />
          </div>
        </div>
      ))}
      <span className="sr-only">Memuat kategori...</span>
    </div>
  );
}
