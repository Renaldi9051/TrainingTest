"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { SearchIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/admin/ui/button";
import { CommandPalette } from "@/components/ui/command-palette";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { FOCUS_ANCHOR_EVENT } from "@/lib/anchor-focus";
import { ADMIN_SEARCH_MIN, buildAdminPaletteGroups } from "@/lib/admin-search";
import { apiFetch } from "@/lib/api/client";
import type { AdminSearchResult } from "@/lib/api/types";
import { isPaletteShortcut, type PaletteStatus } from "@/lib/command-palette";

const subscribeNoop = () => () => {};
const isApplePlatform = () => /Mac|iPhone|iPad/.test(navigator.platform);

// Search global admin (PRD 6.1): tombol di topbar + Ctrl/Cmd+K dari halaman admin mana pun.
// Kalau fokus di editor rich text yang memakai Ctrl/Cmd+K sendiri (sisipkan tautan), palette tidak
// dibuka: shortcut editor memanggil preventDefault lebih dulu.
export function AdminSearch() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const term = useDebouncedValue(query.trim(), 200);
  const enabled = open && term.length >= ADMIN_SEARCH_MIN;
  const shortcut = useSyncExternalStore(subscribeNoop, () => (isApplePlatform() ? "⌘K" : "Ctrl K"), () => "Ctrl K");

  const search = useQuery({
    queryKey: ["admin", "search", term],
    queryFn: async () => (await apiFetch<AdminSearchResult>(`/admin/search?q=${encodeURIComponent(term)}`)).data,
    enabled,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isPaletteShortcut(event)) return;
      event.preventDefault();
      setOpen((current) => !current);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const onOpenChange = useCallback((next: boolean) => setOpen(next), []);

  // Tujuan di halaman yang sama dengan hash (field pengaturan): router tidak memicu hashchange.
  function onNavigate(href: string) {
    const url = new URL(href, window.location.origin);
    if (url.pathname === pathname && url.hash) window.dispatchEvent(new CustomEvent(FOCUS_ANCHOR_EVENT, { detail: url.hash }));
    setQuery("");
  }

  const typed = query.trim();
  const groups = typed.length < ADMIN_SEARCH_MIN ? [] : buildAdminPaletteGroups(term, search.data?.q === term ? search.data : undefined);
  // Selesai kalau hasil BE sudah untuk kata kunci terakhir; sambil menunggu, hasil klien (modul,
  // field pengaturan) yang sudah ada tetap ditampilkan.
  const settled = search.data?.q === term && term === typed;
  const status: PaletteStatus =
    typed.length < ADMIN_SEARCH_MIN ? "idle" : search.isError ? "error" : settled || groups.length > 0 ? "ready" : "loading";

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-2 text-fg-muted"
        aria-keyshortcuts="Control+K Meta+K"
        onClick={() => setOpen(true)}
      >
        <SearchIcon aria-hidden strokeWidth={1.5} />
        <span className="hidden sm:inline">Cari</span>
        <span className="sr-only sm:hidden">Cari</span>
        <kbd className="hidden rounded-sm border border-border px-1 font-mono text-[11px] sm:inline">{shortcut}</kbd>
      </Button>
      <CommandPalette
        open={open}
        onOpenChange={onOpenChange}
        label="Cari di panel admin"
        placeholder="Cari pelatihan, halaman, media, pengaturan..."
        query={query}
        onQueryChange={setQuery}
        groups={groups}
        status={status}
        hint="Ketik minimal 2 huruf. Draf ikut dicari; item di Sampah tidak."
        onNavigate={onNavigate}
      />
    </>
  );
}
