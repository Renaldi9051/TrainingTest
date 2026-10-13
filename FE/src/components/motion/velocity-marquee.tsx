"use client";

import { type ReactNode, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { focusOffset, nextSpeed, wrapOffset } from "./marquee-plan";

// Isi berjalan horizontal mengikuti kecepatan scroll (DESIGN.md 8.2), dipakai logo klien dan section
// teks besar. Server selalu merender tata letak akhir: satu baris (overflow hidden) + salinan kedua
// untuk putaran tanpa celah (aria-hidden, inert: tidak dibaca dua kali, tidak bisa difokus), jadi tidak
// ada perubahan layout setelah load (CLS 0). JS hanya menggerakkan transform: diam tanpa scroll,
// kecepatan & arah ikut scroll, juga kalau marquee sudah terlihat di layar pertama.
// Reduced motion: lewat CSS saja (motion-reduce), isi dibungkus ke beberapa baris dan salinan kedua
// disembunyikan; JS tidak berjalan. Fokus keyboard di dalam marquee: berhenti dan elemen itu digeser
// ke layar. listClassName memakai varian motion-reduce: untuk tata letak statisnya.
export function VelocityMarquee({
  children,
  copy,
  className,
  listClassName,
}: {
  children: ReactNode;
  // Isi salinan kedua (default sama dengan children), mis. pola solid/outline yang dibalik.
  copy?: ReactNode;
  className?: string;
  listClassName?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const track = trackRef.current;
    if (!root || !track) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;
    let x = 0;
    let speed = 0;
    let frame = 0;
    let inView = false;
    let paused = false;
    let lastScroll = window.scrollY;
    let pendingDelta = 0;
    const half = () => track.scrollWidth / 2;
    const apply = () => {
      track.style.transform = `translate3d(${x}px, 0, 0)`;
    };
    const tick = () => {
      frame = 0;
      speed = paused ? 0 : nextSpeed(speed, pendingDelta);
      pendingDelta = 0;
      if (speed === 0) return;
      x = wrapOffset(x - speed, half());
      apply();
      if (inView) frame = requestAnimationFrame(tick);
    };
    const onScroll = () => {
      const current = window.scrollY;
      pendingDelta += current - lastScroll;
      lastScroll = current;
      if (!frame && inView && !paused) frame = requestAnimationFrame(tick);
    };
    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      lastScroll = window.scrollY;
      if (!inView) {
        cancelAnimationFrame(frame);
        frame = 0;
        speed = 0;
      }
    });
    observer.observe(root);

    // Fokus keyboard: berhenti, elemen terfokus digeser ke layar (salinan pertama).
    const onFocusIn = (event: FocusEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (!target) return;
      paused = true;
      speed = 0;
      // Fokus di dalam overflow:hidden menggulir kontainer secara native; kembalikan, geser lewat x.
      root.scrollLeft = 0;
      const trackRect = track.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      x = focusOffset(targetRect.left - trackRect.left, targetRect.width, root.clientWidth, half());
      apply();
    };
    const onFocusOut = (event: FocusEvent) => {
      if (event.relatedTarget instanceof Node && root.contains(event.relatedTarget)) return;
      paused = false;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    root.addEventListener("focusin", onFocusIn);
    root.addEventListener("focusout", onFocusOut);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
      root.removeEventListener("focusin", onFocusIn);
      root.removeEventListener("focusout", onFocusOut);
      track.style.removeProperty("transform");
    };
  }, []);

  return (
    <div ref={rootRef} data-marquee="" className={cn("overflow-hidden", className)}>
      <div ref={trackRef} className="flex w-max motion-reduce:w-auto motion-reduce:transform-none!">
        <div className={cn("shrink-0 motion-reduce:shrink", listClassName)}>{children}</div>
        <div aria-hidden inert data-marquee-copy="" className={cn("shrink-0 motion-reduce:hidden", listClassName)}>
          {copy ?? children}
        </div>
      </div>
    </div>
  );
}
