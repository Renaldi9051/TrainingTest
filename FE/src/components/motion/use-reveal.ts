"use client";

import { animate } from "motion/mini";
import { type RefObject, useEffectEvent, useLayoutEffect } from "react";
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

const FINAL = { opacity: "1", transform: "none", clipPath: "inset(0% 0% 0% 0%)" } as const;

function applyFrom({ element, from }: RevealStep) {
  if (from.opacity !== undefined) element.style.opacity = String(from.opacity);
  if (from.transform !== undefined) element.style.transform = from.transform;
  if (from.clipPath !== undefined) element.style.clipPath = from.clipPath;
}

function clear({ element, from }: RevealStep) {
  if (from.opacity !== undefined) element.style.removeProperty("opacity");
  if (from.transform !== undefined) element.style.removeProperty("transform");
  if (from.clipPath !== undefined) element.style.removeProperty("clip-path");
}

function play(step: RevealStep) {
  const keyframes: Record<string, string[]> = {};
  if (step.from.opacity !== undefined) keyframes.opacity = [String(step.from.opacity), FINAL.opacity];
  if (step.from.transform !== undefined) keyframes.transform = [step.from.transform, FINAL.transform];
  if (step.from.clipPath !== undefined) keyframes.clipPath = [step.from.clipPath, FINAL.clipPath];
  // Inline style awal dilepas setelah animasi, supaya hover/transisi CSS komponen tetap berlaku.
  void animate(step.element, keyframes, {
    duration: step.duration ?? DURATION.slow,
    delay: step.delay ?? 0,
    ease: [...EASE],
  }).then(() => clear(step));
}

// Reveal saat scroll untuk satu grup (root + elemen di dalamnya).
// Server merender keadaan final. Setelah mount, kalau root seluruhnya di bawah layar awal (dan
// tidak reduced motion), elemen diset ke keadaan awal lalu dianimasikan saat root masuk viewport
// (sekali, margin -10%). Elemen di layar pertama tidak pernah disembunyikan (DESIGN.md 8.3).
export function useReveal<T extends HTMLElement>(ref: RefObject<T | null>, steps: (root: T) => RevealStep[]) {
  const getSteps = useEffectEvent(steps);

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const start = revealStart({
      top: root.getBoundingClientRect().top,
      viewportHeight: window.innerHeight,
      reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      supportsObserver: "IntersectionObserver" in window,
    });
    if (start === "static") return;

    const planned = getSteps(root);
    planned.forEach(applyFrom);
    let played = false;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        played = true;
        observer.disconnect();
        planned.forEach(play);
      },
      { rootMargin: IN_VIEW_MARGIN },
    );
    observer.observe(root);
    return () => {
      observer.disconnect();
      // Dilepas sebelum sempat tampil (mis. navigasi): kembalikan ke keadaan final.
      if (!played) planned.forEach(clear);
    };
  }, [ref]);
}
