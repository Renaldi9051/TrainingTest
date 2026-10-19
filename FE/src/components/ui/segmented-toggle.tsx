"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { segmentKeyTarget } from "./segmented-plan";

export type SegmentOption<T extends string> = { value: T; label: string; icon?: ReactNode };

// Pilihan tampilan bersebelahan (mis. list/kalender di /jadwal). Radiogroup: satu tab stop, panah
// memindah pilihan, pilihan aktif latar --primary teks --on-primary.
export function SegmentedToggle<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  className?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const activeIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const target = segmentKeyTarget(activeIndex, event.key, options.length);
    if (target === null) return;
    event.preventDefault();
    onChange(options[target].value);
    refs.current[target]?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn("inline-flex gap-0.5 rounded-md border border-border-strong p-[3px]", className)}
    >
      {options.map((option, index) => {
        const checked = index === activeIndex;
        return (
          <button
            key={option.value}
            ref={(element) => {
              refs.current[index] = element;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex h-8 items-center gap-2 rounded-[4px] px-3.5 text-[13px] font-medium outline-none",
              "transition-colors duration-150 ease-standard [&_svg]:size-4 [&_svg]:shrink-0",
              "focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2",
              checked ? "bg-primary text-on-primary" : "text-fg-muted hover:text-fg-strong",
            )}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
