"use client";

import { ChevronDownIcon, SearchIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/admin/ui/popover";
import type { CategoryOption } from "@/lib/api/types";

const VISIBLE_LIMIT = 50;

export function CategoryPicker({
  options,
  value,
  onChange,
  label,
  id,
  emptyValue,
  emptyLabel,
}: {
  options: CategoryOption[];
  value: string;
  onChange: (value: string) => void;
  label: string;
  id?: string;
  emptyValue?: string;
  emptyLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selected = options.find((item) => item.id === value);
  const matches = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("id-ID");
    return term
      ? options.filter((item) => `${item.name} ${item.slug}`.toLocaleLowerCase("id-ID").includes(term))
      : options;
  }, [options, search]);
  const pick = (id: string) => {
    onChange(id);
    setOpen(false);
    setSearch("");
  };

  return (
    <Popover open={open} onOpenChange={(next) => { setOpen(next); if (!next) setSearch(""); }}>
      <PopoverTrigger asChild>
        <Button id={id} type="button" variant="outline" aria-label={label} aria-expanded={open} className="max-w-52 min-w-40 justify-between gap-2 font-normal">
          <span className="truncate">{selected?.name ?? emptyLabel ?? "Pilih kategori"}</span>
          <ChevronDownIcon className="size-4 shrink-0" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-2">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-muted" aria-hidden />
          <Input
            type="search"
            autoFocus
            aria-label="Cari nama atau slug kategori"
            placeholder="Cari nama atau slug kategori"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-9"
          />
        </div>
        <div className="mt-2 max-h-64 overflow-y-auto" aria-label="Pilihan kategori">
          {emptyValue !== undefined && !search ? (
            <button type="button" onClick={() => pick(emptyValue)} className="block w-full rounded-sm px-3 py-2 text-left text-small hover:bg-bg-subtle" aria-current={value === emptyValue ? "true" : undefined}>
              {emptyLabel}
            </button>
          ) : null}
          {matches.slice(0, VISIBLE_LIMIT).map((item) => (
            <button key={item.id} type="button" onClick={() => pick(item.id)} className="block w-full rounded-sm px-3 py-2 text-left text-small hover:bg-bg-subtle" aria-current={value === item.id ? "true" : undefined}>
              <span className="block truncate font-medium">{item.name}</span>
              <span className="block truncate font-mono text-xs text-fg-muted">{item.slug}</span>
            </button>
          ))}
          {matches.length === 0 ? <p className="px-3 py-3 text-small text-fg-muted">Kategori tidak ditemukan.</p> : null}
        </div>
        {matches.length > VISIBLE_LIMIT ? (
          <p className="border-t border-border px-3 pt-2 text-xs text-fg-muted">
            Menampilkan {VISIBLE_LIMIT} dari {matches.length}. Ketik nama untuk mempersempit.
          </p>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
