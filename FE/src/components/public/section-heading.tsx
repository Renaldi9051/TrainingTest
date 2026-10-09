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
  children,
}: {
  index?: string;
  eyebrow: string;
  title?: string;
  id?: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={cn("space-y-3", className)}>
      <Eyebrow index={index}>{eyebrow}</Eyebrow>
      {title ? (
        <h2 id={id} className="text-[28px] leading-[1.1] font-semibold tracking-[-0.03em] text-fg-strong md:text-[40px]">
          {title}
        </h2>
      ) : null}
      {children}
    </div>
  );
}
