"use client";

import { useSyncExternalStore } from "react";
import { OPEN_PUBLIC_SEARCH_EVENT } from "@/lib/public-search-event";
import { cn } from "@/lib/utils";

const subscribeNoop = () => () => {};
const isApplePlatform = () => /Mac|iPhone|iPad/.test(navigator.platform);

// Petunjuk "Cari judul pelatihan? Tekan Ctrl K". Bisa diklik juga (membuka command palette yang
// sama dengan header), supaya tidak hanya bisa lewat keyboard.
export function OpenSearchHint({ lead = "Cari judul pelatihan?", className }: { lead?: string; className?: string }) {
  const shortcut = useSyncExternalStore(subscribeNoop, () => (isApplePlatform() ? "⌘ K" : "Ctrl K"), () => "Ctrl K");
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      onClick={() => window.dispatchEvent(new Event(OPEN_PUBLIC_SEARCH_EVENT))}
      className={cn(
        "inline-flex flex-wrap items-center gap-1.5 rounded-sm text-small text-fg-muted outline-none hover:text-fg-strong focus-visible:ring-2 focus-visible:ring-focus",
        className,
      )}
    >
      {lead} Tekan
      <kbd className="rounded-[4px] border border-border-strong bg-bg px-1.5 py-0.5 font-mono text-[12px] leading-none text-fg">
        {shortcut}
      </kbd>
    </button>
  );
}
