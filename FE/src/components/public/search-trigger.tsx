"use client";

import { SearchIcon } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { isPaletteShortcut } from "@/lib/command-palette";
import { OPEN_PUBLIC_SEARCH_EVENT } from "@/lib/public-search-event";

// Kode palette tidak masuk JS awal halaman: dimuat saat pertama dibuka (di-prefetch saat hover/fokus).
const loadPalette = () => import("./public-search-palette");
const PublicSearchPalette = dynamic(loadPalette, { ssr: false });

const subscribeNoop = () => () => {};
const isApplePlatform = () => /Mac|iPhone|iPad/.test(navigator.platform);

// Tombol "Cari pelatihan" di header + Ctrl/Cmd+K (DESIGN.md 7). Tanpa JS tetap link ke katalog.
// Link "Cari pelatihan" di menu mobile membuka palette yang sama lewat OPEN_PUBLIC_SEARCH_EVENT.
export function SearchTrigger({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const shortcut = useSyncExternalStore(subscribeNoop, () => (isApplePlatform() ? "⌘K" : "Ctrl K"), () => "Ctrl K");

  const show = () => {
    setLoaded(true);
    setOpen(true);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isPaletteShortcut(event)) return;
      event.preventDefault();
      setLoaded(true);
      setOpen((current) => !current);
    };
    const onOpenRequest = () => {
      setLoaded(true);
      setOpen(true);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener(OPEN_PUBLIC_SEARCH_EVENT, onOpenRequest);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener(OPEN_PUBLIC_SEARCH_EVENT, onOpenRequest);
    };
  }, []);

  function onClick(event: MouseEvent<HTMLAnchorElement>) {
    // Ctrl/Cmd/Shift + klik atau klik tengah: biarkan browser membuka katalog di tab/jendela baru.
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    show();
  }

  return (
    <>
      <Link
        href="/pelatihan"
        prefetch={false}
        aria-haspopup="dialog"
        aria-keyshortcuts="Control+K Meta+K"
        onClick={onClick}
        onPointerEnter={() => void loadPalette()}
        onFocus={() => void loadPalette()}
        className={className}
      >
        <SearchIcon className="size-4" strokeWidth={1.5} aria-hidden />
        Cari pelatihan
        <kbd aria-hidden className="rounded-sm border border-border px-1 font-mono text-[11px] text-fg-muted">
          {shortcut}
        </kbd>
      </Link>
      {/* Portal ke body: tombol ini ada di kontainer header desktop yang disembunyikan di layar kecil,
          sedangkan dialog di dalam leluhur display:none tidak tampil (dibuka dari menu mobile). */}
      {loaded ? createPortal(<PublicSearchPalette open={open} onOpenChange={setOpen} />, document.body) : null}
    </>
  );
}
