"use client";

import { XIcon } from "lucide-react";
import { useState, type ComponentProps, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";

type TagInputProps = Omit<ComponentProps<"input">, "value" | "onChange"> & {
  value: string[];
  onChange: (value: string[]) => void;
  max: number;
  // Label tombol hapus per chip untuk pembaca layar, mis. (tag) => `Hapus kata kunci ${tag}`.
  removeLabel: (tag: string) => string;
};

// Daftar teks pendek sebagai chip. Enter atau koma menambah, Backspace di input kosong menghapus
// chip terakhir, teks yang belum ditambahkan ikut masuk saat input kehilangan fokus. Duplikat
// (abaikan huruf besar/kecil) tidak ditambahkan; validasi panjang tetap di schema form.
// id/aria-* dari FormField diteruskan ke <input>.
export function TagInput({ value, onChange, max, removeLabel, className, onBlur, disabled, ...inputProps }: TagInputProps) {
  const [draft, setDraft] = useState("");
  const full = value.length >= max;

  const commit = () => {
    const tag = draft.replace(/\s+/g, " ").trim();
    setDraft("");
    if (!tag || full) return;
    if (value.some((item) => item.toLocaleLowerCase("id-ID") === tag.toLocaleLowerCase("id-ID"))) return;
    onChange([...value, tag]);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      commit();
    } else if (event.key === "Backspace" && draft === "" && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <div
      className={cn(
        "flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border border-input bg-bg px-2 py-1.5",
        "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
        "has-[input[aria-invalid=true]]:border-destructive",
        disabled && "opacity-50",
        className,
      )}
    >
      {value.map((tag, index) => (
        <span key={`${tag}-${index}`} className="inline-flex items-center gap-1 rounded-full border border-border py-0.5 pr-1 pl-2.5 text-small">
          {tag}
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange(value.filter((_, position) => position !== index))}
            aria-label={removeLabel(tag)}
            className="rounded-full p-0.5 text-fg-muted hover:bg-bg-subtle hover:text-fg-strong focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <XIcon className="size-3.5" strokeWidth={1.5} aria-hidden />
          </button>
        </span>
      ))}
      <input
        {...inputProps}
        disabled={disabled || full}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={onKeyDown}
        onBlur={(event) => {
          commit();
          onBlur?.(event);
        }}
        className="h-6 min-w-32 flex-1 bg-transparent px-1 text-small outline-none placeholder:text-fg-subtle disabled:cursor-not-allowed"
      />
    </div>
  );
}
