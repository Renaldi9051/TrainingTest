"use client";

import { type ReactNode, useEffect, useRef } from "react";
import { IMAGE_ZOOM, REVEAL_FROM, type RevealKind } from "./reveal-plan";
import { batchDelays, groupRows } from "./reveal-rows-plan";
import { revealStart } from "./reveal-state";
import { observeOnce, unobserveOnce } from "./shared-observer";
import { applyFrom, clear, play, type RevealStep } from "./use-reveal";

type RowsTag = "ul" | "ol" | "tbody";

type Row = { items: HTMLElement[]; state: "hidden" | "playing" | "final"; steps: RevealStep[]; animations: ReturnType<typeof play>[] };

// Langkah satu elemen baris (dan gambar di dalamnya: wipe + zoom, jeda sama dengan kartunya).
function itemSteps(item: HTMLElement, kind: RevealKind, delay: number): RevealStep[] {
  const steps: RevealStep[] = [{ element: item, from: REVEAL_FROM[kind], delay }];
  item.querySelectorAll<HTMLElement>('[data-reveal="image"]').forEach((frame) => {
    steps.push({ element: frame, from: REVEAL_FROM.image, delay });
    const img = frame.querySelector("img");
    if (img) steps.push({ element: img, from: IMAGE_ZOOM, delay });
  });
  return steps;
}

// Daftar/grid/tabel panjang yang di-reveal per baris visual: baris yang seluruhnya di bawah layar
// awal disembunyikan lalu masuk saat barisnya masuk viewport (satu observer bersama untuk semua
// baris, lihat shared-observer). Baris di layar pertama tidak pernah disembunyikan (DESIGN.md 8.3).
// Aturan lain sama dengan useReveal: diputuskan di useEffect (setelah scroll ke anchor), keputusan
// disimpan per instance (Back tidak menyembunyikan lagi), posisi melompat sebelum frame berikutnya
// = langsung final, reduced motion / tanpa IntersectionObserver = langsung final.
export function RevealRows({
  as: Tag = "ul",
  kind,
  className,
  children,
}: {
  as?: RowsTag;
  kind: RevealKind;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const decided = useRef(false);

  useEffect(() => {
    const root = ref.current;
    if (!root || decided.current) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const supportsObserver = "IntersectionObserver" in window;
    const viewportHeight = window.innerHeight;

    const items = Array.from(root.children).filter((child): child is HTMLElement => child instanceof HTMLElement);
    const tops = items.map((item) => item.getBoundingClientRect().top);
    const rows: Row[] = groupRows(tops)
      .filter((indexes) => revealStart({ top: tops[indexes[0]], viewportHeight, reducedMotion, supportsObserver }) === "hidden")
      .map((indexes) => ({ items: indexes.map((index) => items[index]), state: "hidden", steps: [], animations: [] }));
    // Seperti useReveal: keputusan final disimpan begitu ada yang tampil/diputar, supaya effect yang
    // berjalan ulang (Back, StrictMode) tidak menyembunyikan lagi. Selama semua masih tersembunyi,
    // cleanup mengembalikan keadaan final dan effect berikutnya boleh memutuskan ulang.
    if (rows.length === 0) {
      decided.current = true;
      return;
    }

    // Keadaan awal (jeda dihitung saat baris diputar, tergantung baris lain yang masuk bersamaan).
    for (const row of rows) {
      row.steps = row.items.flatMap((item) => itemSteps(item, kind, 0));
      row.steps.forEach(applyFrom);
    }
    const rowOf = new Map(rows.flatMap((row) => row.items.map((item) => [item, row] as const)));

    // Baris yang masuk dalam callback observer yang sama diputar sebagai satu batch berbaris.
    let pending: Row[] = [];
    const flush = () => {
      const batch = pending.filter((row) => row.state === "hidden");
      pending = [];
      if (batch.length > 0) decided.current = true;
      const delays = batchDelays(kind, batch.map((row) => row.items.length));
      batch.forEach((row, rowIndex) => {
        row.state = "playing";
        row.items.forEach(unobserveOnce);
        row.steps = row.items.flatMap((item, column) => itemSteps(item, kind, delays[rowIndex][column]));
        row.animations = row.steps.map(play);
        void Promise.all(row.animations).then(() => {
          if (row.state === "playing") row.state = "final";
        });
      });
    };
    const onEnter = (element: Element) => {
      const row = rowOf.get(element as HTMLElement);
      if (!row || row.state !== "hidden") return;
      if (pending.length === 0) queueMicrotask(flush);
      if (!pending.includes(row)) pending.push(row);
    };
    // Setiap elemen diamati (bukan hanya yang pertama): kalau kolom berubah karena resize, baris
    // tetap muncul begitu salah satu elemennya masuk viewport.
    rows.forEach((row) => row.items.forEach((item) => observeOnce(item, onEnter)));

    // Posisi melompat (anchor / scroll restoration) sebelum frame berikutnya: baris yang kini
    // terlihat atau sudah terlewati langsung final tanpa animasi.
    const frame = requestAnimationFrame(() => {
      for (const row of rows) {
        if (row.state !== "hidden" || row.items[0].getBoundingClientRect().top >= window.innerHeight) continue;
        row.state = "final";
        decided.current = true;
        row.items.forEach(unobserveOnce);
        row.steps.forEach(clear);
      }
    });

    return () => {
      cancelAnimationFrame(frame);
      for (const row of rows) {
        row.items.forEach(unobserveOnce);
        // Dilepas sebelum selesai (navigasi, halaman disembunyikan): kembalikan ke keadaan final.
        if (row.state === "playing") row.animations.forEach((animation) => animation.stop());
        if (row.state !== "final") row.steps.forEach(clear);
      }
    };
  }, [kind]);

  const setRef = (node: HTMLElement | null) => {
    ref.current = node;
  };
  // data-reveal-root: elemen data-reveal di dalam baris (gambar kartu) milik root ini, bukan root
  // <Reveal> di sekitarnya.
  return (
    <Tag ref={setRef} data-reveal-root="" data-reveal-rows={kind} className={className}>
      {children}
    </Tag>
  );
}
