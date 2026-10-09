"use client";

import { PlusIcon, Trash2Icon } from "lucide-react";
import { useState, type ReactNode } from "react";
import { SortableList } from "@/components/admin/sortable-list";
import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import { cn } from "@/lib/utils";

let idCounter = 0;
const newKey = () => `item-${++idCounter}`;

type ListEditorProps<T> = {
  value: T[];
  onChange: (value: T[]) => void;
  // Item kosong untuk tombol tambah.
  createItem: () => T;
  renderItem: (args: { item: T; index: number; update: (item: T) => void }) => ReactNode;
  // Label untuk pembaca layar (tombol grip & hapus), mis. "Hasil belajar 2".
  itemLabel: (item: T, index: number) => string;
  addLabel: string;
  max: number;
  emptyText?: string;
  className?: string;
};

// Daftar yang bisa ditambah, dihapus, dan diurutkan (drag & drop / keyboard). Nilai dikontrol
// dari luar (React Hook Form); kunci stabil per item disimpan di sini supaya animasi urutan benar.
export function ListEditor<T>({
  value,
  onChange,
  createItem,
  renderItem,
  itemLabel,
  addLabel,
  max,
  emptyText,
  className,
}: ListEditorProps<T>) {
  const [keys, setKeys] = useState<string[]>(() => value.map(newKey));
  // Nilai berubah dari luar (mis. reset form) dengan jumlah berbeda: buat ulang kunci.
  const syncedKeys = keys.length === value.length ? keys : value.map((_, index) => keys[index] ?? newKey());
  if (syncedKeys !== keys) setKeys(syncedKeys);

  const items = value.map((item, index) => ({ id: syncedKeys[index], item, index }));

  function update(index: number, item: T) {
    onChange(value.map((current, position) => (position === index ? item : current)));
  }

  function remove(index: number) {
    setKeys(syncedKeys.filter((_, position) => position !== index));
    onChange(value.filter((_, position) => position !== index));
  }

  function add() {
    setKeys([...syncedKeys, newKey()]);
    onChange([...value, createItem()]);
  }

  function reorder(ids: string[]) {
    const byKey = new Map(items.map((entry) => [entry.id, entry.item]));
    setKeys(ids);
    onChange(ids.map((id) => byKey.get(id) as T));
  }

  return (
    <div className={cn("space-y-3", className)}>
      {items.length === 0 ? (
        emptyText ? <p className="text-small text-fg-muted">{emptyText}</p> : null
      ) : (
        <SortableList
          items={items}
          itemLabel={(entry) => itemLabel(entry.item, entry.index)}
          onReorder={reorder}
          renderItem={(entry, handle) => (
            <div className="flex items-start gap-2 py-3">
              <div className="pt-0.5">{handle}</div>
              <div className="min-w-0 flex-1">
                {renderItem({ item: entry.item, index: entry.index, update: (item) => update(entry.index, item) })}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Hapus ${itemLabel(entry.item, entry.index)}`}
                onClick={() => remove(entry.index)}
              >
                <Trash2Icon strokeWidth={1.5} aria-hidden />
              </Button>
            </div>
          )}
        />
      )}
      <div className="flex items-center gap-3">
        <Button type="button" variant="outline" size="sm" disabled={value.length >= max} onClick={add}>
          <PlusIcon aria-hidden />
          {addLabel}
        </Button>
        <span className="font-mono text-xs text-fg-muted">
          {value.length}/{max}
        </span>
      </div>
    </div>
  );
}

// Input satu baris dengan penghitung karakter (dipakai di dalam ListEditor).
export function CountedInput({
  id,
  value,
  onChange,
  max,
  label,
  placeholder,
  error,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  max: number;
  // Label tersembunyi untuk pembaca layar.
  label: string;
  placeholder?: string;
  error?: string;
}) {
  const over = value.length > max;
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <label htmlFor={id} className="sr-only">
          {label}
        </label>
        <Input
          id={id}
          value={value}
          placeholder={placeholder}
          aria-invalid={error || over ? true : undefined}
          aria-describedby={`${id}-count${error ? ` ${id}-error` : ""}`}
          onChange={(event) => onChange(event.target.value)}
        />
        <span id={`${id}-count`} className={cn("shrink-0 font-mono text-xs", over ? "text-status-error" : "text-fg-muted")}>
          {value.length}/{max}
        </span>
      </div>
      {error ? (
        <p id={`${id}-error`} className="text-small text-status-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
