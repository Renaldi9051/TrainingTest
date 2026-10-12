"use client";

import type { ContentStatus } from "@/lib/api/types";

const OPTIONS: readonly [ContentStatus, string, string][] = [
  ["DRAFT", "Draf", "Tidak tampil di situs."],
  ["PUBLISHED", "Tayang", "Tampil di situs setelah disimpan."],
];

// Pilihan status konten (draf/tayang) sebagai radio kartu.
export function StatusField({
  name,
  value,
  onChange,
}: {
  name: string;
  value: ContentStatus;
  onChange: (value: ContentStatus) => void;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="sr-only">Status</legend>
      {OPTIONS.map(([option, label, help]) => (
        <label
          key={option}
          className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 has-checked:border-fg-strong"
        >
          <input
            type="radio"
            name={name}
            value={option}
            checked={value === option}
            onChange={() => onChange(option)}
            className="mt-1 accent-[var(--fg-strong)]"
          />
          <span>
            <span className="block text-sm font-medium">{label}</span>
            <span className="block text-small text-fg-muted">{help}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}
