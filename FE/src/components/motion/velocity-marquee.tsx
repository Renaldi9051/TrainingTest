"use client";

import { type ReactNode, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { FRAME_MS, focusOffset, nextSpeed, wrapOffset } from "./marquee-plan";

// Isi berjalan horizontal mengikuti kecepatan scroll (DESIGN.md 8.2), dipakai logo klien dan section
// teks besar. Server selalu merender tata letak akhir: satu baris (overflow hidden) + salinan kedua
// untuk putaran tanpa celah (aria-hidden, inert: tidak dibaca dua kali, tidak bisa difokus), jadi tidak
// ada perubahan layout setelah load (CLS 0). JS hanya menggerakkan transform: kecepatan & arah ikut
// scroll, juga kalau marquee sudah terlihat di layar pertama. Tanpa autoSpeed diam tanpa scroll; dengan
// autoSpeed (logo klien) berjalan sendiri di laju itu selama terlihat, dan berhenti saat kursor di atasnya
// (supaya logo bisa dibaca/diklik). Gerak dikali dt, jadi laju sama di layar 60 Hz maupun 120 Hz.
// Reduced motion: lewat CSS saja (motion-reduce), isi dibungkus ke beberapa baris dan salinan kedua
// disembunyikan; JS tidak berjalan. Fokus keyboard di dalam marquee: berhenti dan elemen itu digeser
// ke layar. listClassName memakai varian motion-reduce: untuk tata letak statisnya.
export function VelocityMarquee({
  children,
  copy,
  className,
  listClassName,
  autoSpeed = 0,
}: {
  children: ReactNode;
  // Laju dasar saat tidak di-scroll (px per frame 60 Hz). 0 = diam tanpa scroll.
  autoSpeed?: number;
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
    let lastTime = 0;
    let inView = false;
    let focused = false;
    let hovered = false;
    let lastScroll = window.scrollY;
    let pendingDelta = 0;
    const paused = () => focused || hovered;
    const half = () => track.scrollWidth / 2;
    const apply = () => {
      track.style.transform = `translate3d(${x}px, 0, 0)`;
    };
    const tick = (now: number) => {
      frame = 0;
      // dt dibatasi supaya setelah tab tidak aktif tidak melompat jauh.
      const dt = lastTime ? Math.min(64, now - lastTime) : FRAME_MS;
      lastTime = now;
      speed = paused() ? 0 : nextSpeed(speed, pendingDelta, autoSpeed);
      pendingDelta = 0;
      if (speed === 0) {
        lastTime = 0;
        return;
      }
      x = wrapOffset(x - speed * (dt / FRAME_MS), half());
      apply();
      if (inView) frame = requestAnimationFrame(tick);
    };
    const start = () => {
      if (!frame && inView && !paused()) frame = requestAnimationFrame(tick);
    };
    const onScroll = () => {
      const current = window.scrollY;
      pendingDelta += current - lastScroll;
      lastScroll = current;
      start();
    };
    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      lastScroll = window.scrollY;
      if (!inView) {
        cancelAnimationFrame(frame);
        frame = 0;
        lastTime = 0;
        speed = 0;
      } else if (autoSpeed > 0) {
        start();
      }
    });
    observer.observe(root);

    // Fokus keyboard: berhenti, elemen terfokus digeser ke layar (salinan pertama).
    const onFocusIn = (event: FocusEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (!target) return;
      focused = true;
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
      focused = false;
      start();
    };
    // Mode otomatis: berhenti selama kursor di atas marquee, lanjut saat kursor keluar.
    const onPointerEnter = () => {
      if (autoSpeed > 0) hovered = true;
    };
    const onPointerLeave = () => {
      hovered = false;
      start();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    root.addEventListener("focusin", onFocusIn);
    root.addEventListener("focusout", onFocusOut);
    root.addEventListener("pointerenter", onPointerEnter);
    root.addEventListener("pointerleave", onPointerLeave);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
      root.removeEventListener("focusin", onFocusIn);
      root.removeEventListener("focusout", onFocusOut);
      root.removeEventListener("pointerenter", onPointerEnter);
      root.removeEventListener("pointerleave", onPointerLeave);
      track.style.removeProperty("transform");
    };
  }, [autoSpeed]);

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
