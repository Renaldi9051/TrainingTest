import { describe, expect, it } from "vitest";
import { PARALLAX_MAX_PX, parallaxOffset } from "./parallax-plan";

describe("parallaxOffset", () => {
  it("maksimal 80 px: kanan saat masuk dari bawah, kiri saat keluar di atas", () => {
    expect(PARALLAX_MAX_PX).toBe(80);
    // Section tepat di bawah layar (belum masuk).
    expect(parallaxOffset(800, 400, 800)).toBe(80);
    // Section sudah lewat di atas layar.
    expect(parallaxOffset(-400, 400, 800)).toBe(-80);
  });

  it("0 saat section di tengah lintasan", () => {
    // Lintasan 1200 px: tengah saat top = 800 - 600 = 200.
    expect(parallaxOffset(200, 400, 800)).toBe(0);
  });

  it("tidak melewati batas di luar lintasan", () => {
    expect(parallaxOffset(5000, 400, 800)).toBe(80);
    expect(parallaxOffset(-5000, 400, 800)).toBe(-80);
    expect(parallaxOffset(0, 0, 0)).toBe(0);
  });
});
