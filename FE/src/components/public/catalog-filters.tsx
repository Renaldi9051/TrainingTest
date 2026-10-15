"use client";

import { SlidersHorizontalIcon } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { IndexItem } from "@/lib/index-groups";
import { IndexOverlay } from "./index-overlay";

const DESKTOP_QUERY = "(min-width: 64rem)";

// Panel filter katalog. Desktop (lg): selalu terbuka sebagai sidebar (CSS ::details-content di
// public.css, ditambah atribut open setelah hydrate). Mobile: bisa dilipat dan otomatis terbuka
// kalau ada filter aktif (perilaku dari versi sebelumnya dipertahankan). Tanpa JS tetap <details>.
export function FilterDisclosure({
  defaultOpen,
  activeCount,
  children,
}: {
  defaultOpen: boolean;
  activeCount: number;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const details = ref.current;
    if (!details) return;
    const media = window.matchMedia(DESKTOP_QUERY);
    const sync = () => {
      if (media.matches) details.open = true;
    };
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  return (
    <details ref={ref} open={defaultOpen || undefined} className="filter-disclosure group/filter">
      <summary className="flex h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-md border border-border-strong px-4 text-body text-fg-strong outline-none focus-visible:ring-2 focus-visible:ring-fg-strong focus-visible:ring-offset-2 lg:hidden [&::-webkit-details-marker]:hidden">
        <span className="inline-flex items-center gap-2">
          <SlidersHorizontalIcon aria-hidden strokeWidth={1.5} className="size-4" />
          Filter
          {activeCount > 0 ? (
            <span className="font-mono text-label text-fg-muted">
              ({activeCount}
              <span className="sr-only"> aktif</span>)
            </span>
          ) : null}
        </span>
        <span aria-hidden className="font-mono text-label uppercase tracking-[0.08em] text-fg-muted">
          <span className="group-open/filter:hidden">Buka</span>
          <span className="hidden group-open/filter:inline">Tutup</span>
        </span>
      </summary>
      <div className="pt-6 lg:pt-0">{children}</div>
    </details>
  );
}

// Tombol "Indeks kategori A-Z": overlay layar penuh (sama dengan menu header) berisi semua kategori
// yang punya pelatihan. Di katalog tautannya menambah/melepas filter kategori.
export function CategoryIndexButton({ items }: { items: IndexItem[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 inline-flex h-8 w-full items-center justify-center rounded-md border border-border-strong px-3 text-small text-fg outline-none transition-colors duration-150 ease-standard hover:bg-bg-subtle focus-visible:ring-2 focus-visible:ring-fg-strong focus-visible:ring-offset-2"
      >
        Indeks kategori A-Z
      </button>
      <IndexOverlay open={open} onClose={() => setOpen(false)} items={items} />
    </>
  );
}
