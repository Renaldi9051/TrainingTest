import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

type EyebrowProps = ComponentProps<"p"> & {
  // Nomor urut opsional, tampil sebagai "01 / LAYANAN".
  index?: string;
};

// Label mono kecil di atas judul section (DESIGN.md 3). Efek scramble menyusul di Fase 4.
export function Eyebrow({ index, className, children, ...props }: EyebrowProps) {
  return (
    <p
      className={cn(
        "font-mono text-label font-medium uppercase tracking-[0.08em] text-fg-muted",
        className,
      )}
      {...props}
    >
      {index ? (
        <>
          <span>{index}</span>
          <span aria-hidden> / </span>
        </>
      ) : null}
      {children}
    </p>
  );
}
