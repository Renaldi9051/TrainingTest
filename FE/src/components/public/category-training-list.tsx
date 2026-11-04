"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";
import type { PublicCategoryTraining } from "@/lib/api/types";
import { displayTitle, isUntitled } from "@/lib/display-title";
import { TYPE_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";

// Daftar judul pelatihan dengan filter "cari judul" di klien (tanpa reload). List bernomor: tiap
// baris link ke detail, tipe Public/In-house di kanan. State kosong: pesan "tidak ada yang cocok".
export function CategoryTrainingList({ trainings }: { trainings: PublicCategoryTraining[] }) {
  const [query, setQuery] = useState("");
  const inputId = useId();
  const q = query.trim().toLocaleLowerCase("id-ID");
  const filtered = useMemo(
    () => (q ? trainings.filter((training) => training.title.toLocaleLowerCase("id-ID").includes(q)) : trainings),
    [trainings, q],
  );

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-h2 text-fg-strong">{trainings.length} judul pelatihan</h2>
        <div className="sm:w-72">
          <label htmlFor={inputId} className="sr-only">
            Cari judul pelatihan
          </label>
          <input
            id={inputId}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cari judul..."
            autoComplete="off"
            className="h-11 w-full rounded-md border border-border-strong bg-bg-subtle px-3 text-body text-fg-strong outline-none placeholder:text-fg-subtle focus-visible:border-secondary focus-visible:ring-2 focus-visible:ring-focus"
          />
        </div>
      </div>

      {filtered.length > 0 ? (
        <ol className="border-t border-fg-strong" aria-live="polite">
          {filtered.map((training, index) => (
            <li key={training.slug}>
              <Link
                href={`/pelatihan/${training.slug}`}
                className="group flex items-center gap-4 border-b border-border px-1 py-4 outline-none transition-colors duration-150 ease-standard hover:bg-bg-subtle focus-visible:bg-bg-subtle focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset md:px-2"
              >
                <span className="w-8 shrink-0 font-mono text-label font-medium text-primary-ink tabular-nums">
                  {String(index + 1).padStart(2, "0")}
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
      ) : (
        <p className="border-t border-fg-strong py-10 text-center text-body text-fg-muted">
          Tidak ada judul yang cocok.
        </p>
      )}
    </div>
  );
}
