"use client";

import { BanIcon } from "lucide-react";
import type { ReactNode } from "react";
import { CATEGORY_ICON_NAMES, CATEGORY_ICONS } from "@/lib/category-icons";
import { cn } from "@/lib/utils";

type IconPickerProps = {
  // Nama grup radio; unik per form.
  name: string;
  value: string | null;
  onChange: (value: string | null) => void;
  error?: string;
  description?: string;
};

// Pilihan ikon lucide monokrom (daftar sama dengan BE, lihat lib/category-icons.ts).
// Dipakai kategori dan layanan.
export function IconPicker({ name: groupName, value, onChange, error, description = "Opsional, monokrom." }: IconPickerProps) {
  const option = (name: string | null, label: string, icon: ReactNode) => {
    const checked = value === name;
    return (
      <label
        key={name ?? "none"}
        title={label}
        className={cn(
          "flex size-10 cursor-pointer items-center justify-center rounded-md border text-fg-muted transition-colors duration-150 hover:bg-bg-subtle hover:text-fg-strong has-focus-visible:ring-2 has-focus-visible:ring-ring has-focus-visible:ring-offset-2",
          checked ? "border-fg-strong bg-bg-subtle text-fg-strong" : "border-border",
        )}
      >
        <input
          type="radio"
          name={groupName}
          className="sr-only"
          checked={checked}
          onChange={() => onChange(name)}
          aria-label={label}
        />
        {icon}
      </label>
    );
  };

  return (
    <fieldset>
      <legend className="text-sm font-medium">Ikon</legend>
      <p className="mt-1 mb-3 text-small text-fg-muted">{description}</p>
      <div className="grid grid-cols-6 gap-1.5">
        {option(null, "Tanpa ikon", <BanIcon className="size-4" strokeWidth={1.5} aria-hidden />)}
        {CATEGORY_ICON_NAMES.map((name) => {
          const Icon = CATEGORY_ICONS[name];
          return option(name, name, <Icon className="size-5" strokeWidth={1.5} aria-hidden />);
        })}
      </div>
      {error ? <p className="mt-2 text-small text-status-error">{error}</p> : null}
    </fieldset>
  );
}
