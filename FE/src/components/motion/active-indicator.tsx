"use client";

import { animate } from "motion/mini";
import { type ReactNode, type RefObject, useEffect, useEffectEvent, useLayoutEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { type Box, flipTransform, type IndicatorVariant, indicatorBox } from "./pointer";
import { DURATION, EASE } from "./tokens";

const DEFAULT_SELECTOR = "[aria-current]";

// Indikator aktif yang bergeser (FLIP, hanya transform) ke elemen aktif baru (DESIGN.md 8.2).
// Elemen aktif = elemen pertama di kontainer yang cocok `selector` dan terlihat. Saat muat pertama,
// resize, atau font selesai dimuat indikator langsung diletakkan tanpa animasi; animasi hanya saat
// elemen aktif berubah. Kontainer mendapat data-indicator-ready setelah indikator diletakkan, supaya
// elemen aktif bisa melepas gaya aktifnya sendiri (tanpa JS gaya itu tetap tampil).
export function useActiveIndicator(
  containerRef: RefObject<HTMLElement | null>,
  indicatorRef: RefObject<HTMLElement | null>,
  {
    variant,
    selector = DEFAULT_SELECTOR,
    thickness = 1,
  }: { variant: IndicatorVariant; selector?: string; thickness?: number },
) {
  const shown = useRef(false);
  const animation = useRef<ReturnType<typeof animate> | null>(null);

  const place = useEffectEvent((animated: boolean) => {
    const root = containerRef.current;
    const indicator = indicatorRef.current;
    if (!root || !indicator) return;
    const base = root.getBoundingClientRect();
    const active = [...root.querySelectorAll<HTMLElement>(selector)].find((element) => element.getClientRects().length > 0);
    if (!active || base.width === 0) {
      animation.current?.cancel();
      indicator.style.opacity = "0";
      shown.current = false;
      return;
    }
    const rect = active.getBoundingClientRect();
    const to = indicatorBox(variant, { left: rect.left - base.left, top: rect.top - base.top, width: rect.width, height: rect.height }, thickness);
    // Posisi tampak sekarang (termasuk animasi yang sedang berjalan), supaya klik beruntun mulus.
    let from: Box | null = null;
    if (shown.current) {
      const current = indicator.getBoundingClientRect();
      from = { left: current.left - base.left, top: current.top - base.top, width: current.width, height: current.height };
    }
    animation.current?.cancel();
    animation.current = null;
    Object.assign(indicator.style, {
      left: `${to.left}px`,
      top: `${to.top}px`,
      width: `${to.width}px`,
      height: `${to.height}px`,
      opacity: "1",
      transform: "",
    });
    shown.current = true;
    root.setAttribute("data-indicator-ready", "");

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const transform = animated && from && !reduced ? flipTransform(from, to) : null;
    if (!transform) return;
    animation.current = animate(indicator, { transform: [transform, "none"] }, { duration: DURATION.normal, ease: [...EASE] });
  });

  // Setiap render (state aktif bisa berubah lewat props/RSC atau pathname): sebelum paint.
  useLayoutEffect(() => {
    place(true);
  });

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const observer = new ResizeObserver(() => place(false));
    observer.observe(root);
    void document.fonts?.ready.then(() => place(false));
    return () => {
      observer.disconnect();
      animation.current?.cancel();
    };
  }, [containerRef]);
}

// Palet D: pill (chip/filter aktif) --primary, garis (menu, tab, urutan) --secondary (biru tua; di header
// di atas foto hero mustard, palette-d.css).
const INDICATOR_CLASS = {
  pill: "rounded-full bg-primary",
  line: "bg-secondary",
} as const;

// Elemen indikator (aria-hidden). Letakkan sebagai anak pertama kontainer yang `relative`.
// className: mis. "bg-current" supaya warnanya ikut teks induk (header di atas foto hero).
export function IndicatorMark({
  variant,
  ref,
  className,
}: {
  variant: IndicatorVariant;
  ref: RefObject<HTMLSpanElement | null>;
  className?: string;
}) {
  return (
    <span
      ref={ref}
      aria-hidden
      data-active-indicator={variant}
      className={cn("pointer-events-none absolute top-0 left-0 origin-top-left opacity-0", INDICATOR_CLASS[variant], className)}
    />
  );
}

// Kontainer dengan indikator aktif untuk anak yang dirender server (chip filter pilih satu, link urutan).
export function ActiveIndicator({
  variant,
  className,
  selector,
  thickness,
  children,
}: {
  variant: IndicatorVariant;
  className?: string;
  selector?: string;
  // Tebal garis (variant line), px.
  thickness?: number;
  children: ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);
  useActiveIndicator(containerRef, indicatorRef, { variant, selector, thickness });
  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <IndicatorMark variant={variant} ref={indicatorRef} />
      {children}
    </div>
  );
}
