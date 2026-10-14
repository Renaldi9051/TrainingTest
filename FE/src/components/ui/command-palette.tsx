"use client";

import { SearchIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { flattenGroups, moveActive, type PaletteGroup, type PaletteStatus } from "@/lib/command-palette";
import { cn } from "@/lib/utils";

type CommandPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Judul dialog untuk pembaca layar (mis. "Cari di panel admin").
  label: string;
  placeholder: string;
  query: string;
  onQueryChange: (query: string) => void;
  groups: readonly PaletteGroup[];
  status: PaletteStatus;
  // Teks saat kata kunci masih kosong/terlalu pendek.
  hint: ReactNode;
  // Dipanggil setelah navigasi ke hasil benar-benar terjadi (tidak dibatalkan guard).
  onNavigate?: (href: string) => void;
};

// Command palette DESIGN.md 7: dialog tengah layar, input besar, hasil dikelompokkan, panah + Enter.
// <dialog> native (fokus terkurung, Esc menutup). Pola combobox: fokus tetap di input, pilihan aktif
// lewat aria-activedescendant. Tiap hasil adalah link: Enter menjalankan click() supaya guard
// "perubahan belum disimpan" (pencegat klik link) tetap berlaku; palette ditutup hanya kalau navigasi
// tidak dibatalkan. Fokus kembali ke elemen pemicu saat ditutup.
export function CommandPalette({
  open,
  onOpenChange,
  label,
  placeholder,
  query,
  onQueryChange,
  groups,
  status,
  hint,
  onNavigate,
}: CommandPaletteProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const baseId = useId();
  const listboxId = `${baseId}-listbox`;
  const items = flattenGroups(groups);
  // Pilihan kembali ke hasil pertama setiap kata kunci berubah; dibatasi jumlah hasil yang ada.
  const [selectedIndex, setActiveIndex] = useState(0);
  const activeIndex = Math.min(selectedIndex, items.length - 1);
  const optionId = (index: number) => `${baseId}-option-${index}`;
  // Indeks global hasil pertama tiap grup (urutan sama dengan items).
  const offsets = groups.map((_, groupIndex) => groups.slice(0, groupIndex).reduce((sum, group) => sum + group.items.length, 0));

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.showModal();
      inputRef.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  // Ditutup dengan Esc, klik latar, atau setelah navigasi: kabari induk, kembalikan fokus ke pemicu.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const onClose = () => {
      onOpenChange(false);
      const target = opener.current;
      opener.current = null;
      if (target?.isConnected) target.focus();
    };
    dialog.addEventListener("close", onClose);
    return () => dialog.removeEventListener("close", onClose);
  }, [onOpenChange]);

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const next = moveActive(activeIndex, event.key === "ArrowDown" ? 1 : -1, items.length);
      setActiveIndex(next);
      document.getElementById(optionId(next))?.scrollIntoView({ block: "nearest" });
    } else if (event.key === "Enter" && !event.nativeEvent.isComposing) {
      event.preventDefault();
      if (activeIndex >= 0) document.getElementById(optionId(activeIndex))?.click();
    }
  }

  const statusText =
    status === "loading"
      ? "Mencari..."
      : status === "error"
        ? "Pencarian gagal. Coba lagi."
        : status === "ready"
          ? items.length > 0
            ? `${items.length} hasil.`
            : `Tidak ada hasil untuk "${query.trim()}".`
          : "";

  return (
    <dialog
      ref={dialogRef}
      aria-label={label}
      className="m-auto mt-[12vh] w-[min(640px,calc(100vw-32px))] overflow-hidden rounded-md border border-border-strong bg-bg p-0 text-fg backdrop:bg-inverse-bg/40"
      // Klik di latar (di luar kotak dialog) menutup palette.
      onClick={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.close();
      }}
    >
      <div className="flex items-center gap-3 border-b border-border px-4">
        <SearchIcon aria-hidden strokeWidth={1.5} className="size-5 shrink-0 text-fg-muted" />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={items.length > 0}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={activeIndex >= 0 && items.length > 0 ? optionId(activeIndex) : undefined}
          aria-label="Kata kunci"
          placeholder={placeholder}
          value={query}
          onChange={(event) => {
            onQueryChange(event.target.value);
            setActiveIndex(0);
          }}
          onKeyDown={onKeyDown}
          autoComplete="off"
          spellCheck={false}
          className="h-14 min-w-0 flex-1 bg-transparent text-body-lg text-fg-strong outline-none placeholder:text-fg-subtle"
        />
        <kbd className="hidden shrink-0 rounded-sm border border-border px-1.5 font-mono text-label text-fg-muted sm:inline">Esc</kbd>
      </div>

      <div className="max-h-[min(60vh,480px)] overflow-y-auto">
        <div id={listboxId} role="listbox" aria-label="Hasil pencarian" className={cn(items.length > 0 && "py-2")}>
          {groups.map((group, groupIndex) =>
            group.items.length > 0 ? (
              <div key={group.id} role="group" aria-labelledby={`${baseId}-group-${group.id}`}>
                <div
                  id={`${baseId}-group-${group.id}`}
                  className="px-4 pt-3 pb-1 font-mono text-label uppercase tracking-[0.08em] text-fg-muted"
                >
                  {group.label}
                </div>
                {group.items.map((item, itemOffset) => {
                  const itemIndex = offsets[groupIndex] + itemOffset;
                  const selected = itemIndex === activeIndex;
                  return (
                    <Link
                      key={item.key}
                      id={optionId(itemIndex)}
                      href={item.href}
                      prefetch={false}
                      role="option"
                      aria-selected={selected}
                      tabIndex={-1}
                      onMouseMove={() => (selected ? undefined : setActiveIndex(itemIndex))}
                      // Hanya berjalan kalau klik tidak dibatalkan guard (guard menghentikan event di fase capture).
                      onClick={() => {
                        dialogRef.current?.close();
                        onNavigate?.(item.href);
                      }}
                      className={cn(
                        "mx-2 flex items-center gap-3 rounded-md px-2 py-2 outline-none",
                        selected ? "bg-bg-muted text-fg-strong" : "text-fg",
                      )}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-small font-medium">{item.title}</span>
                        {item.meta ? <span className="block truncate text-small text-fg-muted">{item.meta}</span> : null}
                      </span>
                      {item.badge ? (
                        <span className="shrink-0 font-mono text-label uppercase tracking-[0.08em] text-fg-muted">{item.badge}</span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            ) : null,
          )}
        </div>
        {status === "idle" ? <div className="px-4 py-6 text-small text-fg-muted">{hint}</div> : null}
        {status !== "idle" && items.length === 0 ? (
          <p className={cn("px-4 py-6 text-small", status === "error" ? "text-fg" : "text-fg-muted")}>{statusText}</p>
        ) : null}
      </div>

      <div className="flex items-center gap-4 border-t border-border px-4 py-2 font-mono text-label uppercase tracking-[0.08em] text-fg-muted">
        <span>↑↓ pilih</span>
        <span>Enter buka</span>
        <span>Esc tutup</span>
      </div>
      <p role="status" className="sr-only">
        {statusText}
      </p>
    </dialog>
  );
}
