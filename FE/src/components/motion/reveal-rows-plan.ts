import { revealDelay, type RevealKind } from "./reveal-plan";

// Reveal per baris visual untuk grid & tabel panjang (RevealRows). Fungsi murni, dites di Vitest.

// Kelompokkan elemen (urutan dokumen) menjadi baris visual berdasarkan posisi atasnya: elemen
// berturut-turut dengan top yang sama (toleransi px) satu baris. Jumlah kolom mengikuti breakpoint
// yang sedang berlaku karena dibaca dari layout sesungguhnya.
export function groupRows(tops: number[], tolerance = 2): number[][] {
  const rows: number[][] = [];
  let rowTop = Number.NaN;
  tops.forEach((top, index) => {
    const current = rows.at(-1);
    if (current && Math.abs(top - rowTop) <= tolerance) {
      current.push(index);
      return;
    }
    rows.push([index]);
    rowTop = top;
  });
  return rows;
}

// Jeda tiap elemen untuk baris-baris yang masuk viewport bersamaan (satu batch), sesuai urutan
// dokumen: stagger jenisnya berlanjut antar baris (dibatasi STAGGER_CAP), kartu mendapat tambahan
// per kolom. Baris yang masuk sendiri-sendiri mulai dari 0.
export function batchDelays(kind: RevealKind, rowSizes: number[]): number[][] {
  let index = 0;
  return rowSizes.map((size) =>
    Array.from({ length: size }, (_, column) => revealDelay(kind, index++, kind === "card" ? column : 0)),
  );
}
