"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { PlusIcon, SearchIcon, XIcon } from "lucide-react";
import { useId, useState } from "react";
import { OptionRow } from "@/components/admin/option-row";
import { SortableList } from "@/components/admin/sortable-list";
import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import { Skeleton } from "@/components/admin/ui/skeleton";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { apiFetch } from "@/lib/api/client";
import type { OptionItem } from "@/lib/api/types";
import type { AdminResource } from "@/lib/admin-resources";

type OptionMultiPickerProps = {
  resource: AdminResource;
  value: string[];
  onChange: (ids: string[]) => void;
  max: number;
  // Kata benda untuk teks, mis. "layanan".
  noun: string;
  error?: string;
};

const SEARCH_LIMIT = 8;

// Pilih beberapa item dari GET /api/admin/{resource}/options (search + limit), urutan pilihan
// bisa diubah (drag & drop / keyboard). Nilai yang disimpan hanya id; label diambil dari BE.
export function OptionMultiPicker({ resource, value, onChange, max, noun, error }: OptionMultiPickerProps) {
  const searchId = useId();
  const [search, setSearch] = useState("");
  const q = useDebouncedValue(search.trim());

  // Label item terpilih (ids selalu ikut dikembalikan BE walau di luar limit).
  const selected = useQuery({
    queryKey: ["admin", resource, "options", "selected", value],
    queryFn: async () =>
      (await apiFetch<OptionItem[]>(`/admin/${resource}/options?limit=1&ids=${value.join(",")}`)).data,
    enabled: value.length > 0,
    placeholderData: keepPreviousData,
  });
  const results = useQuery({
    queryKey: ["admin", resource, "options", "search", q],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: String(SEARCH_LIMIT + value.length) });
      if (q) params.set("q", q);
      return (await apiFetch<OptionItem[]>(`/admin/${resource}/options?${params}`)).data;
    },
    placeholderData: keepPreviousData,
  });

  const byId = new Map((selected.data ?? []).map((item) => [item.id, item]));
  const items = value.map((id) => byId.get(id) ?? { id, label: "Memuat...", sublabel: null, imageUrl: null });
  const candidates = (results.data ?? []).filter((item) => !value.includes(item.id)).slice(0, SEARCH_LIMIT);
  const full = value.length >= max;

  return (
    <div className="space-y-3">
      {items.length === 0 ? (
        <p className="rounded-md border border-dashed border-border-strong px-4 py-4 text-center text-small text-fg-muted">
          Belum ada {noun} yang dipilih.
        </p>
      ) : (
        <SortableList
          items={items}
          itemLabel={(item) => item.label}
          onReorder={onChange}
          renderItem={(item, handle) => (
            <div className="flex items-center gap-3 py-1.5">
              {handle}
              <OptionRow item={item} />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="ml-auto"
                aria-label={`Lepas ${item.label}`}
                onClick={() => onChange(value.filter((id) => id !== item.id))}
              >
                <XIcon strokeWidth={1.5} aria-hidden />
              </Button>
            </div>
          )}
        />
      )}
      {error ? (
        <p role="alert" className="text-small text-status-error">
          {error}
        </p>
      ) : null}

      <div className="space-y-2">
        <label htmlFor={searchId} className="text-sm font-medium">
          Tambah {noun}
        </label>
        <div className="relative">
          <SearchIcon
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-muted"
            strokeWidth={1.5}
            aria-hidden
          />
          <Input
            id={searchId}
            type="search"
            className="pl-9"
            placeholder={`Cari ${noun}`}
            value={search}
            disabled={full}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        {full ? (
          <p className="text-small text-fg-muted">Maksimal {max} {noun}.</p>
        ) : results.isPending ? (
          <Skeleton className="h-16 w-full" />
        ) : results.isError ? (
          <p className="text-small text-status-error">Daftar {noun} tidak dapat dimuat.</p>
        ) : candidates.length === 0 ? (
          <p className="text-small text-fg-muted">{q ? `Tidak ada ${noun} yang cocok.` : `Semua ${noun} sudah dipilih.`}</p>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border" aria-busy={results.isFetching}>
            {candidates.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 px-3 py-2 text-left outline-none hover:bg-bg-subtle focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => onChange([...value, item.id])}
                >
                  <OptionRow item={item} />
                  <PlusIcon className="ml-auto size-4 shrink-0 text-fg-muted" strokeWidth={1.5} aria-hidden />
                  <span className="sr-only">Tambahkan</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
