"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { IndicatorMark, useActiveIndicator } from "./active-indicator";
import { activeSection } from "./scroll-plan";

// Jarak garis baca dari atas viewport: header (64 px) + scroll-mt-24 bagian (96 px) + sedikit ruang.
const READING_LINE_PX = 120;

// Daftar isi yang menandai bagian yang sedang dibaca (aria-current="location") dan menggeser garis
// indikator ke sana (useActiveIndicator, FLIP). Link tetap anchor biasa (keyboard, tanpa JS).
export function ScrollSpyToc({
  sections,
  className,
  spy = true,
}: {
  sections: { id: string; label: string }[];
  className?: string;
  // false: daftar isi mobile (di dalam <details>), cukup link tanpa penanda.
  spy?: boolean;
}) {
  const [active, setActive] = useState(-1);
  const listRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);
  useActiveIndicator(listRef, indicatorRef, { variant: "line", selector: "a[aria-current]" });

  useEffect(() => {
    if (!spy) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const tops = sections.map((section) => document.getElementById(section.id)?.getBoundingClientRect().top ?? Infinity);
      const root = document.documentElement;
      const atBottom = window.scrollY + window.innerHeight >= root.scrollHeight - 2;
      setActive(activeSection(tops, READING_LINE_PX, atBottom));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [sections, spy]);

  return (
    <div ref={listRef} className={cn("relative", className)}>
      {spy ? <IndicatorMark variant="line" ref={indicatorRef} /> : null}
      <ol className="space-y-2">
        {sections.map((section, index) => (
          <li key={section.id}>
            <a
              href={`#${section.id}`}
              aria-current={spy && index === active ? "location" : undefined}
              className="rounded-sm text-small text-fg-muted underline-offset-4 outline-none transition-colors duration-150 hover:text-fg-strong hover:underline focus-visible:ring-2 focus-visible:ring-fg-strong focus-visible:ring-offset-2 aria-[current=location]:text-fg-strong"
            >
              {section.label}
            </a>
          </li>
        ))}
      </ol>
    </div>
  );
}
