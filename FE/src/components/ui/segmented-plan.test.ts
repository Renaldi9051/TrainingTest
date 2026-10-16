import { describe, expect, it } from "vitest";
import { segmentKeyTarget } from "./segmented-plan";

describe("segmentKeyTarget", () => {
  it("panah kanan/bawah ke berikutnya, memutar di ujung", () => {
    expect(segmentKeyTarget(0, "ArrowRight", 3)).toBe(1);
    expect(segmentKeyTarget(2, "ArrowDown", 3)).toBe(0);
  });

  it("panah kiri/atas ke sebelumnya, memutar di awal", () => {
    expect(segmentKeyTarget(1, "ArrowLeft", 3)).toBe(0);
    expect(segmentKeyTarget(0, "ArrowUp", 3)).toBe(2);
  });

  it("Home/End ke pertama/terakhir", () => {
    expect(segmentKeyTarget(1, "Home", 3)).toBe(0);
    expect(segmentKeyTarget(0, "End", 3)).toBe(2);
  });

  it("tombol lain dan daftar kosong diabaikan", () => {
    expect(segmentKeyTarget(0, "Enter", 3)).toBeNull();
    expect(segmentKeyTarget(0, "ArrowRight", 0)).toBeNull();
  });
});
