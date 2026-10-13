import { formatNumber } from "@/lib/format";
import { COUNTER_MS } from "./tokens";

// Counter angka statistik (DESIGN.md 8.2): 0 -> nilai final dalam 900 ms, ease-out cubic.
// Fungsi murni, dites di Vitest.
export function counterValue(final: number, elapsedMs: number, durationMs = COUNTER_MS): number {
  if (elapsedMs >= durationMs) return final;
  const progress = Math.max(0, elapsedMs) / durationMs;
  const eased = 1 - (1 - progress) ** 3;
  return Math.round(final * eased);
}

// Jalankan counter pada elemen bertanda data-reveal-count="<nilai>" (span aria-hidden; nilai final
// untuk pembaca layar ada di teks sr-only, lebar dikunci oleh salinan tak terlihat). Isi node teks
// yang sama diubah supaya React tetap memegang DOM yang benar. Mengembalikan fungsi batal yang
// memulihkan angka final.
export function playCounter(element: HTMLElement): () => void {
  const final = Number(element.dataset.revealCount);
  const node = element.firstChild;
  if (!Number.isFinite(final) || !(node instanceof Text)) return () => {};
  const original = node.data;
  const restore = () => {
    node.data = original;
  };
  const start = performance.now();
  let frame = 0;
  const tick = (now: number) => {
    const elapsed = now - start;
    if (elapsed >= COUNTER_MS) return restore();
    node.data = formatNumber(counterValue(final, elapsed));
    frame = requestAnimationFrame(tick);
  };
  node.data = formatNumber(0);
  frame = requestAnimationFrame(tick);
  return () => {
    cancelAnimationFrame(frame);
    restore();
  };
}
