import { SCRAMBLE_MS } from "./tokens";

const CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const SCRAMBLABLE = /[A-Za-z0-9]/g;
const HAS_SCRAMBLABLE = /[A-Za-z0-9]/;

// Satu frame efek scramble: bagian yang sudah "tersusun" (progress 0..1, dari kiri) memakai teks
// asli, sisanya huruf/angka acak. Spasi & tanda baca tidak diubah; font mono, jadi lebar tetap.
export function scrambleFrame(original: string, progress: number, random: () => number = Math.random): string {
  const settled = Math.floor(Math.min(1, Math.max(0, progress)) * original.length);
  return (
    original.slice(0, settled) +
    original.slice(settled).replace(SCRAMBLABLE, () => CHARSET[Math.floor(random() * CHARSET.length)])
  );
}

// Jalankan scramble pada semua node teks di dalam elemen (node yang sama diubah isinya, tidak
// diganti, supaya React tetap memegang DOM yang benar). Mengembalikan fungsi batal yang memulihkan
// teks asli.
export function playScramble(element: HTMLElement): () => void {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const nodes: { node: Text; original: string }[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node as Text;
    if (HAS_SCRAMBLABLE.test(text.data)) nodes.push({ node: text, original: text.data });
  }
  if (nodes.length === 0) return () => {};

  const restore = () => nodes.forEach(({ node, original }) => (node.data = original));
  const start = performance.now();
  let frame = 0;
  const tick = (now: number) => {
    const progress = (now - start) / SCRAMBLE_MS;
    if (progress >= 1) return restore();
    nodes.forEach(({ node, original }) => (node.data = scrambleFrame(original, progress)));
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
  return () => {
    cancelAnimationFrame(frame);
    restore();
  };
}
