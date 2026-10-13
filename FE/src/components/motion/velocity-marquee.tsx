"use client";

import { type ReactNode, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { focusOffset, nextSpeed, wrapOffset } from "./marquee-plan";

type MarqueeState = "static" | "on";

// Isi berjalan horizontal mengikuti kecepatan scroll (DESIGN.md 8.2), dipakai logo klien dan section
// teks besar. Server merender satu salinan dalam tata letak statis (className list); setelah mount,
// kalau gerak diizinkan dan kontainer tidak sedang terlihat di layar pertama (tanpa geser layout yang
// terlihat), tata letak berganti ke satu baris (data-marquee="on") dan salinan kedua (aria-hidden,
// inert) ditampilkan. Kelas baris diatur pemakai lewat varian group-data-[marquee=on]/marquee.
// Diam tanpa scroll. Fokus keyboard di dalam marquee: berhenti dan elemen itu digeser ke layar.
// Reduced motion / tanpa JS: tetap statis.
export function VelocityMarquee({
  children,
  className,
  listClassName,
  as: List = "div",
  initial = "static",
}: {
  children: ReactNode;
  className?: string;
  // Kelas daftar (statis + varian group-data-[marquee=on]/marquee:...).
  listClassName?: string;
  as?: "div" | "ul";
  // "on": tata letak satu baris sejak server (teks besar tanpa versi statis).
  initial?: MarqueeState;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);

  // Diputuskan sekali setelah mount, langsung di DOM (tanpa render ulang).
  useEffect(() => {
    const root = rootRef.current;
    const track = trackRef.current;
    const copy = copyRef.current;
    if (!root || !track || !copy) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || !("IntersectionObserver" in window)) {
      root.dataset.marquee = "static";
      return;
    }
    const rect = root.getBoundingClientRect();
    // Tata letak statis yang sudah terlihat tidak diubah (CLS); isi baris (initial "on") boleh jalan.
    if (initial === "static" && rect.bottom > 0 && rect.top < window.innerHeight) return;
    root.dataset.marquee = "on";
    copy.hidden = false;
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
    const start = () => {
      if (!frame && inView && !paused) frame = requestAnimationFrame(tick);
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
      copy.hidden = true;
      root.dataset.marquee = initial;
    };
  }, [initial]);

  return (
    <div ref={rootRef} data-marquee={initial} className={cn("group/marquee overflow-hidden", className)}>
      <div ref={trackRef} className="group-data-[marquee=on]/marquee:flex group-data-[marquee=on]/marquee:w-max">
        <List className={listClassName}>{children}</List>
        {/* Salinan kedua untuk putaran tanpa celah: tersembunyi sampai marquee berjalan, selalu
            aria-hidden dan inert (tidak bisa difokus, tidak dibaca dua kali). */}
        <div ref={copyRef} hidden aria-hidden inert className="contents">
          <List className={listClassName}>{children}</List>
        </div>
      </div>
    </div>
  );
}
