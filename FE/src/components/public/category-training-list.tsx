"use client";

import Link from "next/link";
import { useId, useMemo, useRef, useState } from "react";
import { Pagination } from "@/components/public/pagination";
import type { PublicCategoryTraining } from "@/lib/api/types";
import { displayTitle, isUntitled } from "@/lib/display-title";
import { formatNumber } from "@/lib/format";
import { TYPE_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";

export const CATEGORY_LIST_PAGE_SIZE = 20;

// Daftar judul pelatihan dengan filter "cari judul" di klien (tanpa reload). List bernomor: tiap
// baris link ke detail, tipe Public/In-house di kanan. Paginasi 20 judul per halaman di klien (hanya
// section ini); cari judul mencari di semua judul dan kembali ke halaman 1. State kosong: pesan
// "tidak ada yang cocok".
export function CategoryTrainingList({ trainings }: { trainings: PublicCategoryTraining[] }) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const rootRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const inputId = useId();
  const q = query.trim().toLocaleLowerCase("id-ID");
  const filtered = useMemo(
    () => (q ? trainings.filter((training) => training.title.toLocaleLowerCase("id-ID").includes(q)) : trainings),
    [trainings, q],
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / CATEGORY_LIST_PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const offset = (current - 1) * CATEGORY_LIST_PAGE_SIZE;
  const visible = filtered.slice(offset, offset + CATEGORY_LIST_PAGE_SIZE);

  // Ganti halaman: fokus ke judul daftar (tombol yang diklik bisa hilang, mis. "Berikutnya" di halaman
  // terakhir) dan gulir ke atas daftar tanpa animasi.
  const goTo = (next: number) => {
    setPage(next);
    headingRef.current?.focus({ preventScroll: true });
    rootRef.current?.scrollIntoView({ block: "start" });
  };

  return (
    <div ref={rootRef} className="scroll-mt-32">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 ref={headingRef} tabIndex={-1} className="text-h2 text-fg-strong outline-none">
          {formatNumber(trainings.length)} judul pelatihan
        </h2>
        <div className="sm:w-72">
          <label htmlFor={inputId} className="sr-only">
            Cari judul pelatihan
          </label>
          <input
            id={inputId}
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder="Cari judul..."
            autoComplete="off"
            className="h-11 w-full rounded-md border border-border-strong bg-bg-subtle px-3 text-body text-fg-strong outline-none placeholder:text-fg-subtle focus-visible:border-secondary focus-visible:ring-2 focus-visible:ring-focus"
          />
        </div>
      </div>

      {filtered.length > 0 ? (
        <>
          <ol aria-label="Judul pelatihan" className="border-t border-fg-strong" aria-live="polite">
            {visible.map((training, index) => (
              <li key={training.slug}>
                <Link
                  href={`/pelatihan/${training.slug}`}
                  className="group flex items-center gap-4 border-b border-border px-1 py-4 outline-none transition-colors duration-150 ease-standard hover:bg-bg-subtle focus-visible:bg-bg-subtle focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset md:px-2"
                >
                  <span className="w-10 shrink-0 font-mono text-label font-medium text-primary-ink tabular-nums">
                    {String(offset + index + 1).padStart(2, "0")}
                  </span>
                  <span
                    className={cn(
                      "min-w-0 flex-1 text-[20px] font-medium underline-offset-4 group-hover:underline",
                      isUntitled(training.title) ? "text-fg-muted" : "text-fg-strong",
                    )}
                  >
                    {displayTitle(training.title)}
                  </span>
                  {training.types.length > 0 ? (
                    <span className="hidden shrink-0 font-mono text-label uppercase tracking-[0.08em] text-fg-muted sm:inline">
                      {training.types.map((type) => TYPE_LABELS[type]).join(" / ")}
                    </span>
                  ) : null}
                  <span aria-hidden className="shrink-0 text-secondary transition-transform duration-150 ease-standard group-hover:translate-x-1">
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ol>
          {totalPages > 1 ? (
            <div className="mt-8">
              <Pagination
                meta={{ page: current, totalPages }}
                onPage={goTo}
                info={`Halaman ${current} dari ${totalPages} / ${offset + 1}-${offset + visible.length} dari ${formatNumber(filtered.length)}`}
              />
            </div>
          ) : null}
        </>
      ) : (
        <p className="border-t border-fg-strong py-10 text-center text-body text-fg-muted">
          Tidak ada judul yang cocok.
        </p>
      )}
    </div>
  );
}
