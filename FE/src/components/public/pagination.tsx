import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";
import Link from "next/link";
import type { PaginationMeta } from "@/lib/api/types";
import { cn } from "@/lib/utils";

// Nomor halaman yang ditampilkan: 1 ... (p-1) p (p+1) ... terakhir.
export function pageWindow(page: number, totalPages: number): (number | "gap")[] {
  const pages = new Set([1, totalPages, page - 1, page, page + 1].filter((n) => n >= 1 && n <= totalPages));
  const sorted = [...pages].sort((a, b) => a - b);
  return sorted.flatMap((n, index) => (index > 0 && n - sorted[index - 1] > 1 ? ["gap" as const, n] : [n]));
}

const itemClass =
  "inline-flex h-10 min-w-10 items-center justify-center rounded-md px-3 font-mono text-small outline-none focus-visible:ring-2 focus-visible:ring-fg-strong focus-visible:ring-offset-2";

// Paginasi berbasis link (state di URL). hrefFor membentuk URL untuk nomor halaman tertentu.
export function Pagination({ meta, hrefFor }: { meta: PaginationMeta; hrefFor: (page: number) => string }) {
  if (meta.totalPages <= 1) return null;
  const { page, totalPages } = meta;

  return (
    <nav aria-label="Halaman" className="flex items-center justify-between gap-4 border-t border-border pt-6">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className={cn(itemClass, "gap-2 border border-border-strong hover:bg-bg-subtle")}>
          <ArrowLeftIcon className="size-4" strokeWidth={1.5} aria-hidden />
          <span className="font-sans">Sebelumnya</span>
        </Link>
      ) : (
        <span />
      )}
      <ol className="hidden items-center gap-1 sm:flex">
        {pageWindow(page, totalPages).map((item, index) =>
          item === "gap" ? (
            <li key={`gap-${index}`} aria-hidden className="px-1 text-fg-muted">
              …
            </li>
          ) : (
            <li key={item}>
              <Link
                href={hrefFor(item)}
                aria-current={item === page ? "page" : undefined}
                aria-label={`Halaman ${item}`}
                className={cn(itemClass, item === page ? "bg-fg-strong text-inverse-fg" : "hover:bg-bg-subtle")}
              >
                {item}
              </Link>
            </li>
          ),
        )}
      </ol>
      <p className="font-mono text-small text-fg-muted sm:hidden">
        {page} / {totalPages}
      </p>
      {page < totalPages ? (
        <Link href={hrefFor(page + 1)} className={cn(itemClass, "gap-2 border border-border-strong hover:bg-bg-subtle")}>
          <span className="font-sans">Berikutnya</span>
          <ArrowRightIcon className="size-4" strokeWidth={1.5} aria-hidden />
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
