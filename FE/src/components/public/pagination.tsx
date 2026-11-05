import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import type { PaginationMeta } from "@/lib/api/types";
import { cn } from "@/lib/utils";

// Nomor halaman yang ditampilkan: 1 ... (p-1) p (p+1) ... terakhir.
export function pageWindow(page: number, totalPages: number): (number | "gap")[] {
  const pages = new Set([1, totalPages, page - 1, page, page + 1].filter((n) => n >= 1 && n <= totalPages));
  const sorted = [...pages].sort((a, b) => a - b);
  return sorted.flatMap((n, index) => (index > 0 && n - sorted[index - 1] > 1 ? ["gap" as const, n] : [n]));
}

const itemClass =
  "inline-flex h-10 min-w-10 items-center justify-center rounded-md px-3 font-mono text-small outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2";

// Paginasi berbasis link (state di URL). hrefFor membentuk URL untuk nomor halaman tertentu.
// info (opsional): keterangan di kiri (mis. "Halaman 1 dari 7 / 1-24 dari 161"), kontrol di kanan.
export function Pagination({
  meta,
  hrefFor,
  info,
}: {
  meta: PaginationMeta;
  hrefFor: (page: number) => string;
  info?: ReactNode;
}) {
  if (meta.totalPages <= 1) return null;
  const { page, totalPages } = meta;

  const prev =
    page > 1 ? (
      <Link href={hrefFor(page - 1)} className={cn(itemClass, "gap-2 border border-border-strong hover:border-primary hover:text-primary-ink")}>
        <ArrowLeftIcon className="size-4" strokeWidth={1.5} aria-hidden />
        <span className="font-sans">Sebelumnya</span>
      </Link>
    ) : (
      <span />
    );
  const numbers = (
    <>
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
                className={cn(itemClass, item === page ? "bg-primary text-on-primary" : "hover:bg-bg-subtle hover:text-primary-ink")}
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
    </>
  );
  const next =
    page < totalPages ? (
      <Link href={hrefFor(page + 1)} className={cn(itemClass, "gap-2 border border-border-strong hover:border-primary hover:text-primary-ink")}>
        <span className="font-sans">Berikutnya</span>
        <ArrowRightIcon className="size-4" strokeWidth={1.5} aria-hidden />
      </Link>
    ) : (
      <span />
    );

  if (info) {
    return (
      <div className="flex flex-col gap-4 border-t border-border pt-6 md:flex-row md:items-center md:justify-between">
        <p className="font-mono text-label uppercase tracking-[0.08em] text-fg-muted">{info}</p>
        <nav aria-label="Halaman" className="flex items-center justify-between gap-2 md:justify-end">
          {prev}
          {numbers}
          {next}
        </nav>
      </div>
    );
  }

  return (
    <nav aria-label="Halaman" className="flex items-center justify-between gap-4 border-t border-border pt-6">
      {prev}
      {numbers}
      {next}
    </nav>
  );
}
