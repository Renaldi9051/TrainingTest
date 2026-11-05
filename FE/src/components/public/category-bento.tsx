import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";
import { Viewfinder } from "@/components/decor/viewfinder";
import type { PublicCategory } from "@/lib/api/types";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PublicImage } from "./public-image";

// Jumlah kategori unggulan di bento /pelatihan (urutan admin).
export const BENTO_SIZE = 5;

// Tata letak per jumlah ubin. 5 ubin: satu besar (6 kolom x 2 baris) + empat kecil (desktop), besar
// penuh + 2x2 (tablet & mobile). Kurang dari 5: ubin sejajar.
const LAYOUT = {
  5: {
    grid: "grid-cols-12 grid-rows-[280px_180px_180px] md:grid-rows-[240px_200px_200px] lg:grid-rows-[260px_260px]",
    item: (index: number) => (index === 0 ? "col-span-12 lg:col-span-6 lg:row-span-2" : "col-span-6 lg:col-span-3"),
  },
  other: {
    grid: "grid-cols-1 auto-rows-[220px] sm:grid-cols-2 lg:auto-rows-[300px] lg:grid-flow-col lg:grid-cols-none lg:auto-cols-fr",
    item: () => "",
  },
} as const;

// Bento kategori unggulan di atas grid A-Z /pelatihan (mockup redesign 5 Nov 2026). Ubin foto penuh
// (grading film) dengan gradasi gelap ke bawah (--overlay-bottom, sama dengan hero) supaya teks terang
// terbaca; nomor urut mono di kiri atas, "[N] JUDUL" + nama di kiri bawah, tombol panah mustard di
// kanan bawah. Ubin menandai dirinya permukaan gelap (data-surface), jadi sudut Viewfinder mustard.
// Hover/fokus: foto zoom 1.03, sudut masuk, panah bergeser. Ubin pertama = gambar LCP.
export function CategoryBento({ categories }: { categories: PublicCategory[] }) {
  if (categories.length === 0) return null;
  const layout = categories.length === BENTO_SIZE ? LAYOUT[5] : LAYOUT.other;
  return (
    <ul className={cn("grid gap-3 md:gap-4", layout.grid)}>
      {categories.map((category, index) => {
        const big = index === 0 && categories.length === BENTO_SIZE;
        return (
          <li key={category.slug} className={layout.item(index)}>
            <Link
              href={`/pelatihan/kategori/${category.slug}`}
              data-featured-card={category.slug}
              data-surface="dark"
              className={cn(
                "group relative isolate block h-full overflow-hidden rounded-card bg-inverse-bg text-inverse-fg outline-none",
                "focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-4 focus-visible:ring-offset-bg",
              )}
            >
              {category.image ? (
                <PublicImage
                  image={category.image}
                  sizes={big ? "(min-width: 1024px) 640px, 100vw" : "(min-width: 1024px) 320px, 50vw"}
                  film
                  priority={index === 0}
                  className="transition-transform duration-500 ease-standard group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                />
              ) : null}
              <div aria-hidden className="pointer-events-none absolute inset-0 z-[1] bg-linear-to-b from-transparent from-25% to-overlay-bottom to-90%" />
              <Viewfinder size="sm" tone="photo" hover className="z-[2]" />
              <span aria-hidden className="absolute top-3 left-3.5 z-[2] font-mono text-label font-medium tracking-[0.08em] text-inverse-fg/90 sm:top-[18px] sm:left-[22px]">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div
                className={cn(
                  "absolute inset-x-0 bottom-0 z-[2] flex items-end justify-between gap-4",
                  big ? "p-[22px] lg:p-8" : "p-3 sm:p-[14px] md:p-[22px]",
                )}
              >
                <div className="min-w-0">
                  <p className="font-mono text-label font-medium uppercase tracking-[0.08em] text-inverse-fg/85">
                    {formatNumber(category.trainingCount)} judul
                  </p>
                  <h3
                    className={cn(
                      "mt-1.5 font-semibold text-inverse-fg",
                      big
                        ? "text-[30px] leading-[1.1] tracking-[-0.03em] lg:text-[40px]"
                        : "text-[18px] leading-[1.15] tracking-[-0.02em] md:text-[24px]",
                    )}
                  >
                    {category.name}
                  </h3>
                </div>
                <span
                  aria-hidden
                  className={cn(
                    "grid shrink-0 place-items-center rounded-full bg-cta text-on-cta transition-transform duration-150 ease-standard group-hover:translate-x-[3px] motion-reduce:transition-none",
                    big ? "size-11" : "size-9 max-sm:hidden md:size-11",
                  )}
                >
                  <ArrowRightIcon className="size-[18px]" strokeWidth={1.8} />
                </span>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
