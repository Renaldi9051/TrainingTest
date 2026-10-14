"use client";

import { animate } from "motion/mini";
import { useEffect, useRef } from "react";
import { nextRotateIndex, shouldRotate, type RotateBlockers } from "./rotate-plan";
import { useRotationPaused } from "./rotation-context";
import { EASE, ROTATE_INTERVAL_MS, ROTATE_SWAP_MS } from "./tokens";

const OUT = "translateY(-105%)";
const IN = "translateY(105%)";

// Kata kunci hero yang berganti terus tiap 3 s (slot vertikal, DESIGN.md 8.2). Berhenti di kata yang
// sedang tampil saat dijeda, kursor di atas judul, tab tidak aktif, atau hero di luar layar; lanjut
// dari kata itu. Semua kata dirender di satu sel grid (lebar = kata terpanjang, tanpa geser layout);
// tanpa JS hanya kata pertama terlihat. Slot aria-hidden: pembaca layar membaca kata pertama (sr-only)
// sekali, tidak diumumkan ulang tiap berganti. Reduced motion: diam di kata pertama.
export function RotatingWord({ words, className }: { words: string[]; className?: string }) {
  const refs = useRef<(HTMLSpanElement | null)[]>([]);
  const slotRef = useRef<HTMLSpanElement>(null);
  // Kata yang sedang tampil; bertahan saat effect dipasang ulang (jeda/lanjut).
  const current = useRef(0);
  const paused = useRotationPaused();
  const count = words.length;

  useEffect(() => {
    const slot = slotRef.current;
    if (count < 2 || !slot || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const elements = refs.current;
    const heading = slot.closest("h1") ?? slot;
    const blockers: RotateBlockers = { paused, hovered: heading.matches(":hover"), hidden: document.hidden, offscreen: false };
    const animations: ReturnType<typeof animate>[] = [];
    let timer = 0;

    const swap = () => {
      const from = current.current;
      const to = nextRotateIndex(from, count);
      const out = elements[from];
      const into = elements[to];
      if (!out || !into) return;
      current.current = to;
      out.style.transform = OUT;
      into.style.transform = "translateY(0)";
      const options = { duration: ROTATE_SWAP_MS / 1000, ease: [...EASE] as [number, number, number, number] };
      // Pergantian sebelumnya sudah lama selesai (300 ms dari jeda 3 s): cukup simpan yang terbaru.
      animations.splice(0, animations.length, animate(out, { transform: ["translateY(0)", OUT] }, options), animate(into, { transform: [IN, "translateY(0)"] }, options));
    };
    // Jadwal ulang dari nol setiap kondisi berubah: setelah lanjut, kata tampil penuh 3 s dulu.
    const schedule = () => {
      window.clearTimeout(timer);
      if (!shouldRotate(count, blockers)) return;
      timer = window.setTimeout(() => {
        swap();
        schedule();
      }, ROTATE_INTERVAL_MS);
    };
    const update = (change: Partial<RotateBlockers>) => {
      Object.assign(blockers, change);
      schedule();
    };

    const onEnter = () => update({ hovered: true });
    const onLeave = () => update({ hovered: false });
    const onVisibility = () => update({ hidden: document.hidden });
    const observer = new IntersectionObserver(([entry]) => update({ offscreen: !entry.isIntersecting }));
    heading.addEventListener("pointerenter", onEnter);
    heading.addEventListener("pointerleave", onLeave);
    document.addEventListener("visibilitychange", onVisibility);
    observer.observe(slot);
    schedule();

    return () => {
      window.clearTimeout(timer);
      // Animasi yang terputus: cancel (bukan stop, lihat 4.1d). Nilai akhir sudah dipasang inline.
      animations.forEach((animation) => animation.cancel());
      observer.disconnect();
      heading.removeEventListener("pointerenter", onEnter);
      heading.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [count, paused]);

  return (
    <>
      <span className="sr-only">{words[0]}</span>
      <span ref={slotRef} aria-hidden data-rotating-word="" className={`inline-grid overflow-hidden align-top ${className ?? ""}`}>
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
