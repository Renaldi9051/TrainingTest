"use client";

import { animate } from "motion/mini";
import { useEffect, useRef } from "react";
import { rotateSchedule } from "./rotate-plan";
import { EASE, ROTATE_SWAP_MS } from "./tokens";

const OUT = "translateY(-105%)";
const IN = "translateY(105%)";

// Kata kunci hero yang berganti (slot vertikal) satu putaran lalu berhenti di kata pertama
// (DESIGN.md 8.2). Semua kata dirender di satu sel grid (lebar = kata terpanjang, tanpa geser layout);
// hanya kata pertama terlihat tanpa JS. Slot aria-hidden: pembaca layar membaca kata pertama dari
// teks sr-only, sekali. Reduced motion atau tab disembunyikan: tetap/kembali di kata pertama.
export function RotatingWord({ words, className }: { words: string[]; className?: string }) {
  const refs = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    const steps = rotateSchedule(words.length);
    if (steps.length === 0 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const elements = refs.current;
    const animations: ReturnType<typeof animate>[] = [];
    const reset = () => {
      animations.forEach((animation) => animation.cancel());
      elements.forEach((element, index) => {
        if (element) element.style.transform = index === 0 ? "" : IN;
      });
    };
    // Muat penuh: waktu dihitung sejak halaman tampil (time origin), supaya total tetap <= 5 s.
    // Navigasi klien (atau hidrasi yang sangat lambat): sejak mount.
    const now = performance.now();
    const origin = now > steps[0].at ? now : 0;
    const timers = steps.map((step) =>
      window.setTimeout(() => {
        const out = elements[step.from];
        const into = elements[step.to];
        if (!out || !into) return;
        out.style.transform = OUT;
        into.style.transform = step.to === 0 ? "" : "translateY(0)";
        const options = { duration: ROTATE_SWAP_MS / 1000, ease: [...EASE] as [number, number, number, number] };
        animations.push(animate(out, { transform: ["translateY(0)", OUT] }, options));
        animations.push(animate(into, { transform: [IN, "translateY(0)"] }, options));
      }, Math.max(0, origin + step.at - now)),
    );
    const stop = () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      reset();
    };
    const onVisibility = () => {
      if (document.hidden) stop();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      stop();
    };
  }, [words.length]);

  return (
    <>
      <span className="sr-only">{words[0]}</span>
      <span aria-hidden data-rotating-word="" className={`inline-grid overflow-hidden align-top ${className ?? ""}`}>
        {words.map((word, index) => (
          <span
            key={`${index}-${word}`}
            ref={(node) => {
              refs.current[index] = node;
            }}
            className="col-start-1 row-start-1 whitespace-nowrap"
            style={index === 0 ? undefined : { transform: IN }}
          >
            {word}
          </span>
        ))}
      </span>
    </>
  );
}
