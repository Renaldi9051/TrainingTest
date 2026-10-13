"use client";

import { animate } from "motion/mini";
import { type RefObject, useEffect, useEffectEvent, useRef } from "react";
import { revealStart } from "./reveal-state";
import { DURATION, EASE, IN_VIEW_MARGIN } from "./tokens";

// Satu elemen yang dianimasikan saat grupnya masuk viewport. `from` = keadaan awal (hanya
// opacity, transform, clip-path: DESIGN.md 8.3); keadaan akhir selalu keadaan final dari server.
export type RevealStep = {
  element: HTMLElement | SVGElement;
  from: { opacity?: number; transform?: string; clipPath?: string };
  delay?: number;
  duration?: number;
};

export type RevealGroup = {
  steps: RevealStep[];
  // Efek tambahan saat grup diputar (mis. scramble eyebrow). Mengembalikan fungsi batal.
  onPlay?: () => () => void;
};

const FINAL = { opacity: "1", transform: "none", clipPath: "inset(0% 0% 0% 0%)" } as const;

export function applyFrom({ element, from }: RevealStep) {
  if (from.opacity !== undefined) element.style.opacity = String(from.opacity);
  if (from.transform !== undefined) element.style.transform = from.transform;
  if (from.clipPath !== undefined) element.style.clipPath = from.clipPath;
}

export function clear({ element, from }: RevealStep) {
  if (from.opacity !== undefined) element.style.removeProperty("opacity");
  if (from.transform !== undefined) element.style.removeProperty("transform");
  if (from.clipPath !== undefined) element.style.removeProperty("clip-path");
}

export function play(step: RevealStep) {
  const keyframes: Record<string, string[]> = {};
  if (step.from.opacity !== undefined) keyframes.opacity = [String(step.from.opacity), FINAL.opacity];
  if (step.from.transform !== undefined) keyframes.transform = [step.from.transform, FINAL.transform];
  if (step.from.clipPath !== undefined) keyframes.clipPath = [step.from.clipPath, FINAL.clipPath];
  // Inline style awal dilepas setelah animasi, supaya hover/transisi CSS komponen tetap berlaku.
  const animation = animate(step.element, keyframes, {
    duration: step.duration ?? DURATION.slow,
    delay: step.delay ?? 0,
    ease: [...EASE],
  });
  void animation.then(() => clear(step));
  return animation;
}

// Reveal saat scroll untuk satu grup (root + elemen di dalamnya).
// Server merender keadaan final. Setelah mount, kalau root seluruhnya di bawah layar (dan tidak
// reduced motion), elemen diset ke keadaan awal lalu dianimasikan saat root masuk viewport (sekali,
// margin -10%). Elemen yang terlihat tidak pernah disembunyikan (DESIGN.md 8.3), termasuk saat
// halaman dibuka lewat anchor (#id) atau Back dengan scroll restoration:
// - Posisi diukur di useEffect, setelah semua layout effect. Next menggulir ke #id (navigasi klien)
//   di layout effect segmen induk, jadi pengukuran di layout effect halaman masih melihat posisi lama.
// - Keputusan disimpan per instance: grup yang sudah tampil/diputar tidak disembunyikan lagi saat
//   halaman dipulihkan (Back) dan effect berjalan ulang.
// - Kalau posisi melompat (anchor/restoration) setelah disembunyikan dan sebelum frame berikutnya,
//   grup langsung kembali final tanpa animasi.
export function useReveal<T extends HTMLElement>(ref: RefObject<T | null>, build: (root: T) => RevealGroup) {
  const getGroup = useEffectEvent(build);
  const decided = useRef(false);

  useEffect(() => {
    const root = ref.current;
    if (!root || decided.current) return;
    const start = revealStart({
      top: root.getBoundingClientRect().top,
      viewportHeight: window.innerHeight,
      reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      supportsObserver: "IntersectionObserver" in window,
    });
    if (start === "static") {
      decided.current = true;
      return;
    }

    const { steps, onPlay } = getGroup(root);
    steps.forEach(applyFrom);
    let cancelExtra: (() => void) | undefined;
    const animations: ReturnType<typeof play>[] = [];
    let state: "hidden" | "playing" | "final" = "hidden";

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || state !== "hidden") return;
        state = "playing";
        decided.current = true;
        observer.disconnect();
        animations.push(...steps.map(play));
        cancelExtra = onPlay?.();
      },
      { rootMargin: IN_VIEW_MARGIN },
    );
    observer.observe(root);
    const frame = requestAnimationFrame(() => {
      if (state !== "hidden" || root.getBoundingClientRect().top >= window.innerHeight) return;
      state = "final";
      decided.current = true;
      observer.disconnect();
      steps.forEach(clear);
    });

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      // Dilepas sebelum selesai (navigasi, halaman disembunyikan): kembalikan ke keadaan final.
      if (state === "playing") {
        animations.forEach((animation) => animation.stop());
        cancelExtra?.();
      }
      if (state !== "final") steps.forEach(clear);
    };
  }, [ref]);
}
