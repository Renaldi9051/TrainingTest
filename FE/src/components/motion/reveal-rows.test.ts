import { describe, expect, it } from "vitest";
import { batchDelays, groupRows } from "./reveal-rows-plan";
import { STAGGER_CAP } from "./tokens";

describe("groupRows", () => {
  it("mengelompokkan per posisi atas, jumlah kolom mengikuti layout", () => {
    // 3 kolom (lg).
    expect(groupRows([0, 0, 0, 400, 400, 400, 800])).toEqual([[0, 1, 2], [3, 4, 5], [6]]);
    // 2 kolom (sm).
    expect(groupRows([0, 0, 400, 400, 800])).toEqual([[0, 1], [2, 3], [4]]);
    // 1 kolom / baris tabel.
    expect(groupRows([0, 60, 120])).toEqual([[0], [1], [2]]);
  });

  it("toleransi pembulatan subpiksel", () => {
    expect(groupRows([100, 100.4, 101.9, 500])).toEqual([[0, 1, 2], [3]]);
  });

  it("kosong", () => {
    expect(groupRows([])).toEqual([]);
  });
});

describe("batchDelays", () => {
  it("baris yang masuk sendiri: kartu 0, lalu kolom kanan +80 ms stagger +60 ms kolom", () => {
    expect(batchDelays("card", [3])).toEqual([[0, 0.14, 0.28]]);
  });

  it("baris tabel yang masuk bersamaan berbaris 40 ms", () => {
    expect(batchDelays("item", [1, 1, 1])).toEqual([[0], [0.04], [0.08]]);
  });

  it("stagger berlanjut antar baris dalam satu batch dan dibatasi", () => {
    expect(batchDelays("card", [3, 3])[1]).toEqual([0.24, 0.38, 0.52]);
    const long = batchDelays("item", Array.from({ length: 20 }, () => 1)).flat();
    expect(Math.max(...long)).toBe(Number((STAGGER_CAP * 0.04).toFixed(3)));
  });
});
