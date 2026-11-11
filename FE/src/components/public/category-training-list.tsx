"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { Pagination } from "@/components/public/pagination";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import type { PublicCategoryTraining, PublicCategoryTrainingsMeta } from "@/lib/api/types";
import { displayTitle, isUntitled } from "@/lib/display-title";
import { formatNumber } from "@/lib/format";
import { TYPE_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";

// Sama dengan CATEGORY_TRAININGS_PAGE_SIZE di BE.
export const CATEGORY_LIST_PAGE_SIZE = 20;

type Page = { items: PublicCategoryTraining[]; total: number; totalPages: number };
type Status = "idle" | "loading" | "error";

const keyOf = (page: number, term: string) => `${page}|${term}`;

// Daftar judul pelatihan di landing kategori, 20 per halaman. Halaman 1 tanpa pencarian datang dari
// server (ikut cache halaman); halaman lain dan "cari judul" diambil dari
// GET /api/public/categories/:slug/trainings (debounce 250 ms, permintaan lama dibatalkan, hasil
// disimpan selama halaman terbuka). Kategori besar (ribuan judul) jadi tidak dikirim utuh.
// Selama memuat, daftar sebelumnya tetap tampil (aria-busy). State kosong & gagal punya pesan sendiri.
export function CategoryTrainingList({
  slug,
  initial,
  total,
}: {
  slug: string;
  initial: PublicCategoryTraining[];
  total: number;
}) {
  const [query, setQuery] = useState("");
  const term = useDebouncedValue(query.trim(), 250);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<Status>("idle");
  const [retry, setRetry] = useState(0);
  const [first] = useState<Page>(() => ({
    items: initial,
    total,
    totalPages: Math.max(1, Math.ceil(total / CATEGORY_LIST_PAGE_SIZE)),
  }));
  const cache = useRef(new Map<string, Page>([[keyOf(1, ""), first]]));
  const [shown, setShown] = useState<{ key: string; page: number; data: Page }>({ key: keyOf(1, ""), page: 1, data: first });
  const rootRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const inputId = useId();
  const key = keyOf(page, term);

  useEffect(() => {
    const cached = cache.current.get(key);
    if (cached) {
      setShown({ key, page, data: cached });
      setStatus("idle");
      return;
    }
    const controller = new AbortController();
    setStatus("loading");
    const params = new URLSearchParams({ hal: String(page) });
    if (term) params.set("q", term);
    fetch(`/api/public/categories/${encodeURIComponent(slug)}/trainings?${params}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const body = (await response.json()) as { data: PublicCategoryTraining[]; meta: PublicCategoryTrainingsMeta };
        const data = { items: body.data, total: body.meta.total, totalPages: body.meta.totalPages };
        cache.current.set(key, data);
        setShown({ key, page, data });
        setStatus("idle");
      })
      .catch(() => {
        if (!controller.signal.aborted) setStatus("error");
      });
    return () => controller.abort();
  }, [key, page, term, slug, retry]);

  // Ganti halaman: fokus ke judul daftar (tombol yang diklik bisa hilang, mis. "Berikutnya" di halaman
  // terakhir) dan gulir ke atas daftar tanpa animasi.
  const goTo = (next: number) => {
    setPage(next);
    headingRef.current?.focus({ preventScroll: true });
    rootRef.current?.scrollIntoView({ block: "start" });
  };

  const { items, totalPages } = shown.data;
  const current = shown.page;
  const offset = (current - 1) * CATEGORY_LIST_PAGE_SIZE;
  const loading = status === "loading";

  return (
    <div ref={rootRef} className="scroll-mt-32">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 ref={headingRef} tabIndex={-1} className="text-h2 text-fg-strong outline-none">
          {formatNumber(total)} judul pelatihan
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
            maxLength={100}
            className="h-11 w-full rounded-md border border-border-strong bg-bg-subtle px-3 text-body text-fg-strong outline-none placeholder:text-fg-subtle focus-visible:border-secondary focus-visible:ring-2 focus-visible:ring-focus"
          />
        </div>
      </div>

      {status === "error" ? (
        <div role="alert" className="border-t border-fg-strong py-10 text-center text-body text-fg-muted">
          <p>Daftar pelatihan tidak dapat dimuat.</p>
          <button
            type="button"
            onClick={() => setRetry((value) => value + 1)}
            className="mt-3 text-link underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            Coba lagi
          </button>
        </div>
      ) : items.length > 0 ? (
        <div aria-busy={loading} className={cn("transition-opacity duration-150", loading && "opacity-60")}>
          <ol aria-label="Judul pelatihan" className="border-t border-fg-strong" aria-live="polite">
            {items.map((training, index) => (
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
                info={`Halaman ${current} dari ${totalPages} / ${offset + 1}-${offset + items.length} dari ${formatNumber(shown.data.total)}`}
              />
            </div>
          ) : null}
        </div>
      ) : (
        <p aria-busy={loading} className="border-t border-fg-strong py-10 text-center text-body text-fg-muted">
          {loading ? "Memuat..." : "Tidak ada judul yang cocok."}
        </p>
      )}
    </div>
  );
}
