import { IMAGE_ZOOM_FROM, REVEAL_SHIFT_PX, STAGGER, WORD_RISE, staggerDelay } from "./tokens";

// Kosakata gerak DESIGN.md 8.2. Server menandai elemen dengan data-reveal="<jenis>" (atau
// data-reveal-children="<jenis>" untuk semua anak langsung sebuah daftar); root <Reveal> menyusun
// rencananya di browser. Keadaan awal hanya opacity, transform, clip-path (DESIGN.md 8.3).
export type RevealKind = "word" | "line" | "image" | "wipe" | "item" | "card" | "pop";

export type RevealFrom = { opacity?: number; transform?: string; clipPath?: string };

export const REVEAL_FROM: Record<RevealKind, RevealFrom> = {
  // Judul: kata naik dari balik garis (mask di markup, lihat RevealText).
  word: { transform: `translateY(${WORD_RISE})` },
  // Garis pemisah digambar dari kiri (transform-origin kiri di markup, lihat LineDraw).
  line: { transform: "scaleX(0)" },
  // Gambar: wipe dari bawah; zoom 1,15 -> 1 dipasang ke <img> di dalamnya.
  image: { clipPath: "inset(100% 0% 0% 0%)" },
  // Callout / blok penting: wipe dari kiri.
  wipe: { clipPath: "inset(0% 100% 0% 0%)" },
  // Daftar & baris tabel: masuk dari kiri.
  item: { opacity: 0, transform: `translateX(-${REVEAL_SHIFT_PX}px)` },
  // Kartu grid: naik sedikit.
  card: { opacity: 0, transform: `translateY(${REVEAL_SHIFT_PX}px)` },
  // Chip / ikon / logo: membesar sedikit.
  pop: { opacity: 0, transform: "scale(0.92)" },
};

export const IMAGE_ZOOM: RevealFrom = { transform: `scale(${IMAGE_ZOOM_FROM})` };

const KIND_STAGGER: Record<RevealKind, number> = {
  word: STAGGER.word,
  line: 0,
  image: 0,
  wipe: 0,
  item: STAGGER.list,
  card: STAGGER.card,
  pop: STAGGER.chip,
};

export function isRevealKind(value: string | undefined): value is RevealKind {
  return value !== undefined && value in REVEAL_FROM;
}

// Jeda satu elemen: urutan dalam jenisnya x stagger jenis itu (+ kolom untuk kartu).
export function revealDelay(kind: RevealKind, index: number, column = 0): number {
  return staggerDelay(index, KIND_STAGGER[kind], kind === "card" ? column : 0);
}

export type PlannedElement = { element: HTMLElement; from: RevealFrom; delay: number };

export type RevealPlan = { elements: PlannedElement[]; scramble: HTMLElement[]; counters: HTMLElement[] };

// Kolom kartu dihitung dari posisi relatif terhadap daftarnya (0 = paling kiri).
function columnOf(element: HTMLElement): number {
  const parent = element.parentElement;
  const width = element.getBoundingClientRect().width;
  if (!parent || width === 0) return 0;
  return Math.max(0, Math.round((element.getBoundingClientRect().left - parent.getBoundingClientRect().left) / width));
}

// Susun rencana untuk satu root. Elemen milik root lain di dalamnya (root bersarang) dilewati.
export function planReveal(root: HTMLElement): RevealPlan {
  const owned = (element: Element) => element.closest("[data-reveal-root]") === root;
  const marked: { element: HTMLElement; kind: RevealKind }[] = [];
  // Root sendiri bisa berupa daftar (<Reveal as="ul" data-reveal-children="card">).
  [root, ...root.querySelectorAll<HTMLElement>("[data-reveal], [data-reveal-children]")].forEach((element) => {
    if (!owned(element)) return;
    const own = element.dataset.reveal;
    if (isRevealKind(own)) marked.push({ element, kind: own });
    const childKind = element.dataset.revealChildren;
    if (isRevealKind(childKind)) {
      Array.from(element.children).forEach((child) => {
        if (child instanceof HTMLElement) marked.push({ element: child, kind: childKind });
      });
    }
  });
  // Urutan dokumen: elemen anak dari data-reveal-children bisa muncul setelah penandanya.
  marked.sort((a, b) => (a.element.compareDocumentPosition(b.element) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));

  const counters = new Map<RevealKind, number>();
  const cardDelays = new Map<Element, number>();
  // Gambar di dalam kartu ikut jeda kartunya (kartu selalu mendahului gambarnya di urutan dokumen).
  const enclosingCardDelay = (element: HTMLElement) => {
    for (let node = element.parentElement; node && node !== root; node = node.parentElement) {
      const delay = cardDelays.get(node);
      if (delay !== undefined) return delay;
    }
    return 0;
  };
  const elements: PlannedElement[] = [];
  for (const { element, kind } of marked) {
    const index = counters.get(kind) ?? 0;
    counters.set(kind, index + 1);
    const delay = kind === "image" ? enclosingCardDelay(element) : revealDelay(kind, index, kind === "card" ? columnOf(element) : 0);
    if (kind === "card") cardDelays.set(element, delay);
    elements.push({ element, from: REVEAL_FROM[kind], delay });
    if (kind === "image") {
      const img = element.querySelector("img");
      if (img) elements.push({ element: img, from: IMAGE_ZOOM, delay });
    }
  }

  const scramble = Array.from(root.querySelectorAll<HTMLElement>("[data-reveal-scramble]")).filter(owned);
  const countUps = Array.from(root.querySelectorAll<HTMLElement>("[data-reveal-count]")).filter(owned);
  return { elements, scramble, counters: countUps };
}
