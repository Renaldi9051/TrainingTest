"use client";

import { ChevronDownIcon } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";

export type AccordionItem = { id: string; title: ReactNode; meta?: ReactNode; content: ReactNode };

// Accordion berbasis <details>/<summary>: bisa dibuka dengan keyboard (Enter/Spasi) dan tetap
// berfungsi tanpa JavaScript. "Buka semua" hanya mengubah atribut open setiap item.
export function Accordion({
  items,
  toggleAll = false,
  label,
}: {
  items: AccordionItem[];
  toggleAll?: boolean;
  // Nama daftar untuk tombol "Buka semua", mis. "materi".
  label: string;
}) {
  const listRef = useRef<HTMLUListElement>(null);
  const [openCount, setOpenCount] = useState(0);
  const allOpen = openCount === items.length && items.length > 0;

  function syncCount() {
    setOpenCount(listRef.current?.querySelectorAll("details[open]").length ?? 0);
  }

  function setAll(open: boolean) {
    listRef.current?.querySelectorAll("details").forEach((element) => {
      element.open = open;
    });
    syncCount();
  }

  return (
    <div>
      {toggleAll && items.length > 1 ? (
        <div className="mb-3 flex justify-end">
          <button
            type="button"
            onClick={() => setAll(!allOpen)}
            aria-label={`${allOpen ? "Tutup" : "Buka"} semua ${label}`}
            className="rounded-sm text-small text-fg underline underline-offset-4 outline-none hover:text-fg-strong focus-visible:ring-2 focus-visible:ring-fg-strong focus-visible:ring-offset-2"
          >
            {allOpen ? "Tutup semua" : "Buka semua"}
          </button>
        </div>
      ) : null}
      <ul ref={listRef} className="divide-y divide-border border-y border-border">
        {items.map((item) => (
          <li key={item.id}>
            <details className="group" onToggle={syncCount}>
              <summary className="flex cursor-pointer list-none items-start gap-4 py-5 outline-none focus-visible:ring-2 focus-visible:ring-fg-strong focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
                <span className="min-w-0 flex-1 text-body font-medium text-fg-strong">{item.title}</span>
                {item.meta ? (
                  <span className="shrink-0 pt-0.5 font-mono text-label uppercase tracking-[0.08em] text-fg-muted">
                    {item.meta}
                  </span>
                ) : null}
                <ChevronDownIcon
                  className="mt-0.5 size-5 shrink-0 text-fg-muted transition-transform duration-150 group-open:rotate-180 motion-reduce:transition-none"
                  strokeWidth={1.5}
                  aria-hidden
                />
              </summary>
              <div className="pb-6">{item.content}</div>
            </details>
          </li>
        ))}
      </ul>
    </div>
  );
}
