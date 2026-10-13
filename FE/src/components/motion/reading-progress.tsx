"use client";

import { useEffect, useRef } from "react";
import { readingProgress } from "./scroll-plan";

// Garis progres baca 2 px tepat di bawah header (DESIGN.md 8.2): panjang = progres scroll halaman,
// hanya transform (scaleX). Tetap tampil saat reduced motion (informasi, tanpa smoothing).
// Hiasan visual (aria-hidden); posisi baca sudah terlihat dari scrollbar.
export function ReadingProgress() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const bar = ref.current;
    if (!bar) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const root = document.documentElement;
      bar.style.transform = `scaleX(${readingProgress(window.scrollY, root.scrollHeight, window.innerHeight)})`;
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      data-reading-progress=""
      // top-16 = tinggi header (h-16), di atas border bawah header.
      className="pointer-events-none fixed inset-x-0 top-16 z-40 h-0.5 origin-left -translate-y-px scale-x-0 bg-fg-strong"
    />
  );
}
