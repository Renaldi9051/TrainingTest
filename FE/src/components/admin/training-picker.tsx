"use client";

import { useQuery } from "@tanstack/react-query";
import { CheckIcon, ChevronsUpDownIcon, Loader2Icon } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/admin/ui/popover";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { apiFetch } from "@/lib/api/client";
import type { PaginationMeta, TrainingListItem } from "@/lib/api/types";
import { cn } from "@/lib/utils";

type TrainingPickerProps = {
  id?: string;
  value: string | null;
  // Judul pelatihan terpilih (dari data yang sudah ada), supaya tidak perlu fetch ulang.
  selectedTitle: string | null;
  onChange: (training: { id: string; title: string }) => void;
  placeholder?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
};

// Pilih satu pelatihan dengan pencarian (katalog bisa ribuan judul, jadi bukan <select> biasa).
export function TrainingPicker({
  id,
  value,
  selectedTitle,
  onChange,
  placeholder = "Pilih pelatihan",
  ...aria
}: TrainingPickerProps) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [active, setActive] = useState(0);
  const q = useDebouncedValue(search.trim(), 250);

  const query = useQuery({
    queryKey: ["admin", "trainings", "picker", q],
    queryFn: async () => {
      const params = new URLSearchParams({ pageSize: "12", sort: "title" });
      if (q) params.set("q", q);
      return (await apiFetch<TrainingListItem[], PaginationMeta>(`/admin/trainings?${params}`)).data;
    },
    enabled: open,
  });
  const items = query.data ?? [];

  function choose(item: TrainingListItem) {
    onChange({ id: item.id, title: item.title });
    setOpen(false);
    setSearch("");
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-invalid={aria["aria-invalid"]}
          aria-describedby={aria["aria-describedby"]}
          className="w-full justify-between font-normal"
        >
          <span className={cn("truncate", !value && "text-fg-muted")}>{value ? selectedTitle : placeholder}</span>
          <ChevronsUpDownIcon className="text-fg-muted" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-80 p-2">
        <Input
          autoFocus
          type="search"
          value={search}
          placeholder="Cari judul atau slug"
          aria-label="Cari pelatihan"
          aria-controls={listId}
          aria-activedescendant={items[active] ? `${listId}-${items[active].id}` : undefined}
          onChange={(event) => {
            setSearch(event.target.value);
            setActive(0);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActive((current) => Math.min(current + 1, items.length - 1));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActive((current) => Math.max(current - 1, 0));
            } else if (event.key === "Enter" && items[active]) {
              event.preventDefault();
              choose(items[active]);
            }
          }}
        />
        <ul id={listId} role="listbox" className="mt-2 max-h-72 overflow-y-auto" aria-busy={query.isFetching}>
          {query.isPending ? (
            <li className="flex items-center gap-2 px-2 py-2 text-small text-fg-muted">
              <Loader2Icon className="size-4 animate-spin" aria-hidden /> Memuat...
            </li>
          ) : query.isError ? (
            <li className="px-2 py-2 text-small text-status-error">Pelatihan tidak dapat dimuat.</li>
          ) : items.length === 0 ? (
            <li className="px-2 py-2 text-small text-fg-muted">Tidak ada pelatihan yang cocok.</li>
          ) : (
            items.map((item, index) => (
              <li
                key={item.id}
                id={`${listId}-${item.id}`}
                role="option"
                aria-selected={item.id === value}
                onMouseEnter={() => setActive(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(item)}
                className={cn(
                  "flex cursor-pointer items-start gap-2 rounded-sm px-2 py-1.5 text-sm",
                  index === active && "bg-bg-subtle",
                )}
              >
                <CheckIcon
                  className={cn("mt-0.5 size-4 shrink-0", item.id === value ? "opacity-100" : "opacity-0")}
                  aria-hidden
                />
                <span className="min-w-0">
                  <span className="block truncate">{item.title}</span>
                  <span className="block truncate font-mono text-xs text-fg-muted">{item.slug}</span>
                </span>
              </li>
            ))
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
