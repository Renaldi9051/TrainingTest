import type { ReactNode } from "react";
import { Eyebrow } from "@/components/ui/eyebrow";
import { cn } from "@/lib/utils";

// Eyebrow mono + judul section (h2 40/28 px).
export function SectionHeading({
  index,
  eyebrow,
  title,
  id,
  className,
  inverse,
  children,
}: {
  index?: string;
  eyebrow: string;
  title?: string;
  id?: string;
  className?: string;
  // Di section terbalik (latar hitam).
  inverse?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className={cn("space-y-3", className)}>
      {eyebrow ? (
        <Eyebrow index={index} className={inverse ? "text-inverse-fg/70" : undefined}>
          {eyebrow}
        </Eyebrow>
      ) : null}
      {title ? (
        <h2
          id={id}
          className={cn(
            "text-[28px] leading-[1.1] font-semibold tracking-[-0.03em] md:text-[40px]",
            inverse ? "text-inverse-fg" : "text-fg-strong",
          )}
        >
          {title}
        </h2>
      ) : null}
      {children}
    </div>
  );
}
