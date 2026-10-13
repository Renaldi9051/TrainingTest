import type { ReactNode } from "react";
import { Reveal } from "@/components/motion/reveal";
import { RevealText } from "@/components/motion/reveal-parts";
import { Eyebrow } from "@/components/ui/eyebrow";
import { cn } from "@/lib/utils";

// Eyebrow mono + judul section (h2 40/28 px). Di bawah layar awal: eyebrow scramble, judul mask
// reveal per kata (DESIGN.md 8.2).
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
    <Reveal className={cn("space-y-3", className)}>
      {eyebrow ? (
        <Eyebrow index={index} scramble className={inverse ? "text-inverse-fg/70" : undefined}>
          {eyebrow}
        </Eyebrow>
      ) : null}
      {title ? (
        <RevealText
          id={id}
          text={title}
          className={cn(
            "text-[28px] leading-[1.1] font-semibold tracking-[-0.03em] md:text-[40px]",
            inverse ? "text-inverse-fg" : "text-fg-strong",
          )}
        />
      ) : null}
      {children}
    </Reveal>
  );
}
