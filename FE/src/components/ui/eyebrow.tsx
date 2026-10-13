import type { ComponentProps } from "react";
import { ScrambleText } from "@/components/motion/reveal-parts";
import { cn } from "@/lib/utils";

type EyebrowProps = ComponentProps<"p"> & {
  // Nomor urut opsional, tampil sebagai "01 / LAYANAN".
  index?: string;
  // Huruf di-scramble singkat saat grup reveal-nya masuk viewport (perlu root <Reveal>).
  scramble?: boolean;
};

// Label mono kecil di atas judul section (DESIGN.md 3).
export function Eyebrow({ index, scramble, className, children, ...props }: EyebrowProps) {
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
      {scramble ? <ScrambleText>{children}</ScrambleText> : children}
    </p>
  );
}
