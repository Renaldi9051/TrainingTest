import { describe, expect, it } from "vitest";
import { autoplayAllowed, nextSlide, segmentFill, slideCounter, type SlideBlockers } from "./hero-slides-plan";

const free: SlideBlockers = { hover: false, focus: false, hidden: false, offscreen: false, reduced: false, pending: false };

describe("hero slideshow", () => {
  it("autoplay hanya untuk 2+ slide tanpa penahan apa pun", () => {
    expect(autoplayAllowed(3, free)).toBe(true);
    expect(autoplayAllowed(1, free)).toBe(false);
    expect(autoplayAllowed(0, free)).toBe(false);
    for (const key of Object.keys(free) as (keyof SlideBlockers)[]) {
      expect(autoplayAllowed(3, { ...free, [key]: true }), key).toBe(false);
    }
  });

  it("slide berikutnya memutar ke awal", () => {
    expect([0, 1, 2].map((index) => nextSlide(index, 3))).toEqual([1, 2, 0]);
    expect(nextSlide(0, 0)).toBe(0);
  });

  it("isi segmen progres: sebelum penuh, sesudah kosong, aktif sesuai waktu", () => {
    expect(segmentFill(0, 1, 3000, 6000, false)).toBe(1);
    expect(segmentFill(2, 1, 3000, 6000, false)).toBe(0);
    expect(segmentFill(1, 1, 3000, 6000, false)).toBe(0.5);
    expect(segmentFill(1, 1, 9000, 6000, false)).toBe(1);
    expect(segmentFill(1, 1, 0, 6000, true)).toBe(1);
  });

  it("penghitung dua digit", () => {
    expect(slideCounter(0, 4)).toBe("01 / 04");
    expect(slideCounter(5, 6)).toBe("06 / 06");
  });
});
