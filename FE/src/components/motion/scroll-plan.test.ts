import { describe, expect, it } from "vitest";
import { activeSection, readingProgress } from "./scroll-plan";

describe("readingProgress", () => {
  it("0 di atas, 1 di dasar, dibatasi 0..1", () => {
    expect(readingProgress(0, 3000, 1000)).toBe(0);
    expect(readingProgress(1000, 3000, 1000)).toBe(0.5);
    expect(readingProgress(2000, 3000, 1000)).toBe(1);
    expect(readingProgress(2500, 3000, 1000)).toBe(1);
    expect(readingProgress(-50, 3000, 1000)).toBe(0);
  });

  it("halaman pendek (tanpa scroll): penuh", () => {
    expect(readingProgress(0, 800, 1000)).toBe(1);
  });
});

describe("activeSection", () => {
  it("bagian terakhir yang sudah melewati garis baca", () => {
    expect(activeSection([300, 900, 1500], 120, false)).toBe(0);
    expect(activeSection([-400, 100, 700], 120, false)).toBe(1);
    expect(activeSection([-1400, -800, -100], 120, false)).toBe(2);
  });

  it("di dasar halaman: bagian terakhir walau belum melewati garis", () => {
    expect(activeSection([-900, -300, 400], 120, true)).toBe(2);
  });

  it("tanpa bagian: -1", () => {
    expect(activeSection([], 120, false)).toBe(-1);
  });
});
