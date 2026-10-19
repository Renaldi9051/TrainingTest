"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { IndicatorMark, useActiveIndicator } from "./active-indicator";
import { activeSection } from "./scroll-plan";

// Jarak garis baca dari atas viewport: header (72 px) + bar tab (56 px) + sedikit ruang.
const READING_LINE_PX = 160;

// Daftar isi yang menandai bagian yang sedang dibaca (aria-current="location") dan menggeser garis
// indikator ke sana (useActiveIndicator, FLIP). Link tetap anchor biasa (keyboard, tanpa JS).
// horizontal: tab sticky (detail pelatihan); di layar sempit bar bisa digeser dan tab aktif digeser
// ke dalam pandangan. Indikator diukur terhadap daftar selebar isinya (w-max), bukan scroller.
export function ScrollSpyToc({
  sections,
  className,
  spy = true,
  orientation = "vertical",
}: {
  sections: { id: string; label: string }[];
  className?: string;
  // false: cukup link tanpa penanda.
  spy?: boolean;
  orientation?: "vertical" | "horizontal";
}) {
  const [active, setActive] = useState(-1);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);
  useActiveIndicator(listRef, indicatorRef, { variant: "line", selector: "a[aria-current]", thickness: orientation === "horizontal" ? 3 : 2 });

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

  // Tab aktif di luar bar yang tergeser: geser bar (hanya scrollLeft, halaman tidak ikut bergulir).
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (orientation !== "horizontal" || !scroller || active < 0) return;
    const link = scroller.querySelectorAll<HTMLElement>("a")[active];
    if (!link) return;
    const left = link.offsetLeft;
    const right = left + link.offsetWidth;
    if (left < scroller.scrollLeft) scroller.scrollLeft = Math.max(0, left - 16);
    else if (right > scroller.scrollLeft + scroller.clientWidth) scroller.scrollLeft = right - scroller.clientWidth + 16;
  }, [active, orientation]);

  if (orientation === "horizontal") {
    return (
      <div ref={scrollerRef} className={cn("overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", className)}>
        <div ref={listRef} className="relative w-max">
          {spy ? <IndicatorMark variant="line" ref={indicatorRef} /> : null}
          <ol className="flex gap-6 md:gap-8">
            {sections.map((section, index) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  aria-current={spy && index === active ? "location" : undefined}
                  className="inline-flex h-14 items-center rounded-sm text-small whitespace-nowrap text-fg-muted outline-none transition-colors duration-150 hover:text-fg-strong focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset aria-[current=location]:text-fg-strong"
                >
                  {section.label}
                </a>
              </li>
            ))}
          </ol>
        </div>
      </div>
    );
  }

  return (
    <div ref={listRef} className={cn("relative", className)}>
      {spy ? <IndicatorMark variant="line" ref={indicatorRef} /> : null}
      <ol className="space-y-2">
        {sections.map((section, index) => (
          <li key={section.id}>
            <a
              href={`#${section.id}`}
              aria-current={spy && index === active ? "location" : undefined}
              className="rounded-sm text-small text-fg-muted underline-offset-4 outline-none transition-colors duration-150 hover:text-fg-strong hover:underline focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 aria-[current=location]:text-fg-strong"
            >
              {section.label}
            </a>
          </li>
        ))}
      </ol>
    </div>
  );
}
