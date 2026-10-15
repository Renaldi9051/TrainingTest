"use client";

import { ArrowRightIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Container } from "@/components/ui/container";
import { groupIndexItems, type IndexItem } from "@/lib/index-groups";

// Overlay layar penuh berisi indeks A-Z dengan saringan ketik (PRD 5.2): pengganti dropdown panjang
// untuk kategori yang banyak. <dialog> modal native: fokus terkunci di dalam, Esc menutup, fokus
// kembali ke tombol pembuka. Isi (label & tautan) dari CMS.
export function IndexOverlay({
  open,
  onClose,
  items,
  allHref,
  allLabel,
}: {
  open: boolean;
  onClose: () => void;
  items: readonly IndexItem[];
  // Tautan ke halaman induk (mis. katalog), tampil di atas daftar.
  allHref?: string;
  allLabel?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState("");
  const titleId = useId();
  const inputId = useId();
  const groups = useMemo(() => groupIndexItems(items, query), [items, query]);
  const total = groups.reduce((sum, group) => sum + group.items.length, 0);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={() => {
        setQuery("");
        onClose();
      }}
      className="index-overlay fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none overflow-y-auto bg-bg p-0 text-fg backdrop:bg-transparent"
    >
      <Container className="pt-6 pb-16 md:pt-8">
        <div className="mb-8 flex items-center justify-between gap-4 md:mb-10">
          <h2 id={titleId} className="font-mono text-label font-medium uppercase tracking-[0.08em] text-fg-muted">
            Indeks kategori / A-Z
          </h2>
          <button
            type="button"
            onClick={() => ref.current?.close()}
            className="inline-flex h-10 items-center gap-2 rounded-md border border-border-strong px-4 text-small text-fg outline-none transition-colors duration-150 ease-standard hover:bg-bg-subtle focus-visible:ring-2 focus-visible:ring-fg-strong focus-visible:ring-offset-2"
          >
            Tutup
            <XIcon aria-hidden strokeWidth={1.5} className="size-4" />
          </button>
        </div>

        <label htmlFor={inputId} className="sr-only">
          Saring kategori
        </label>
        <input
          id={inputId}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          // Esc di input search berisi teks hanya mengosongkan kolom (perilaku browser); di sini Esc
          // selalu menutup overlay, sama dengan di bagian lain dialog.
          onKeyDown={(event) => {
            if (event.key !== "Escape") return;
            event.preventDefault();
            ref.current?.close();
          }}
          placeholder="Ketik untuk menyaring kategori"
          autoComplete="off"
          className="h-16 w-full rounded-none border-0 border-b border-border-strong bg-transparent px-0 text-[24px] text-fg-strong outline-none placeholder:text-fg-subtle focus-visible:border-fg-strong focus-visible:shadow-[0_1px_0_var(--fg-strong)]"
        />
        <p aria-live="polite" className="mt-3 mb-10 font-mono text-label uppercase tracking-[0.08em] text-fg-muted md:mb-12">
          {total} kategori
        </p>

        {allHref && allLabel ? (
          <Link
            href={allHref}
            onClick={() => ref.current?.close()}
            className="group/all mb-10 inline-flex items-center gap-2 text-body font-medium text-fg-strong underline-offset-4 outline-none hover:underline focus-visible:underline"
          >
            {allLabel}
            <ArrowRightIcon aria-hidden strokeWidth={1.5} className="size-4 transition-transform duration-150 ease-standard motion-safe:group-hover/all:translate-x-1" />
          </Link>
        ) : null}

        {groups.length > 0 ? (
          <div className="gap-6 md:columns-2 lg:columns-4">
            {groups.map((group) => (
              <section key={group.letter} aria-label={`Huruf ${group.letter}`} className="mb-7 break-inside-avoid">
                <p aria-hidden className="mb-2 font-mono text-[32px] leading-none font-medium tracking-[-0.04em] text-fg-strong">
                  {group.letter}
                </p>
                <ul>
                  {group.items.map((entry) => (
                    <li key={entry.href}>
                      <Link
                        href={entry.href}
                        onClick={() => ref.current?.close()}
                        className="flex items-baseline justify-between gap-3 rounded-sm py-1.5 text-[17px] text-fg underline-offset-4 outline-none hover:text-fg-strong hover:underline focus-visible:underline focus-visible:ring-2 focus-visible:ring-fg-strong"
                      >
                        <span>{entry.label}</span>
                        {entry.count !== undefined ? (
                          <span className="font-mono text-label text-fg-muted tabular-nums">{entry.count}</span>
                        ) : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        ) : (
          <p className="text-body text-fg-muted">Tidak ada kategori yang cocok. Coba kata lain.</p>
        )}
      </Container>
    </dialog>
  );
}
