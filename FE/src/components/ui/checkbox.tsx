import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

// Checkbox native (accent --primary; netral di admin), fokus sama dengan input.
export function Checkbox({ className, ...props }: Omit<ComponentProps<"input">, "type">) {
  return (
    <input
      type="checkbox"
      className={cn(
        "size-4 shrink-0 cursor-pointer accent-primary outline-none",
        "focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed",
        className,
      )}
      {...props}
    />
  );
}

// Baris checkbox + label (+ jumlah mono di kanan, mis. jumlah pelatihan per kategori di filter).
export function CheckboxField({
  label,
  count,
  className,
  ...props
}: Omit<ComponentProps<"input">, "type"> & { label: ReactNode; count?: number }) {
  return (
    <label className={cn("flex cursor-pointer items-center gap-2.5 py-1.5 text-small text-fg", className)}>
      <Checkbox {...props} />
      <span className="min-w-0 flex-1">{label}</span>
      {count !== undefined ? (
        <span className="font-mono text-label text-fg-muted tabular-nums">{count}</span>
      ) : null}
    </label>
  );
}
