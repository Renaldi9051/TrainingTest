"use client";

import { useEffect, useState } from "react";
import { CommandPalette } from "@/components/ui/command-palette";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import type { PublicSearchResult } from "@/lib/api/types";
import type { PaletteStatus } from "@/lib/command-palette";
import { buildPublicPaletteGroups, PUBLIC_SEARCH_MIN } from "@/lib/public-search";

// Hasil per kata kunci selama halaman terbuka: mengetik ulang/menghapus huruf tidak memanggil BE lagi
// (BE juga mengirim Cache-Control 30 s).
const cache = new Map<string, PublicSearchResult>();
const CACHE_MAX = 50;

// Palette search publik (dimuat lazy oleh SearchTrigger saat pertama dibuka): pelatihan, kategori,
// layanan dari GET /api/public/search, debounce 250 ms, permintaan lama dibatalkan.
export default function PublicSearchPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [query, setQuery] = useState("");
  const term = useDebouncedValue(query.trim(), 250);
  // Dinaikkan setiap hasil baru masuk cache (cache di luar state React).
  const [, setVersion] = useState(0);
  const [failedTerm, setFailedTerm] = useState<string | null>(null);

  useEffect(() => {
    if (term.length < PUBLIC_SEARCH_MIN || cache.has(term)) return;
    const controller = new AbortController();
    fetch(`/api/public/search?q=${encodeURIComponent(term)}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const body = (await response.json()) as { data: PublicSearchResult };
        if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value ?? "");
        cache.set(term, body.data);
        setFailedTerm(null);
        setVersion((version) => version + 1);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailedTerm(term);
      });
    return () => controller.abort();
  }, [term]);

  const typed = query.trim();
  const result = term === typed ? (cache.get(term) ?? null) : null;
  const groups = buildPublicPaletteGroups(typed, result);
  const status: PaletteStatus =
    typed.length < PUBLIC_SEARCH_MIN ? "idle" : failedTerm === term && !result ? "error" : result ? "ready" : "loading";

  return (
    <CommandPalette
      open={open}
      onOpenChange={onOpenChange}
      label="Cari pelatihan"
      placeholder="Cari pelatihan, kategori, atau layanan..."
      query={query}
      onQueryChange={setQuery}
      groups={groups}
      status={status}
      hint="Ketik minimal 2 huruf, mis. pilot drone atau fotografi udara."
      onNavigate={() => setQuery("")}
    />
  );
}
