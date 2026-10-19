import { describe, expect, it } from "vitest";
import { badgeRingChars, badgeRingText } from "./badge-ring";
import { formatIndex, imageStackSlots } from "./decor-plan";

describe("badgeRingText", () => {
  it("uppercase, spasi dirapikan, diakhiri pemisah", () => {
    expect(badgeRingText("  Konsultasi   gratis • hubungi kami ")).toBe("KONSULTASI GRATIS • HUBUNGI KAMI • ");
  });

  it("tidak menggandakan pemisah di ujung", () => {
    expect(badgeRingText("Hubungi kami •")).toBe("HUBUNGI KAMI • ");
  });

  it("teks kosong = tanpa huruf", () => {
    expect(badgeRingText("   ")).toBe("");
    expect(badgeRingChars("")).toEqual([]);
  });
});

describe("badgeRingChars", () => {
  it("huruf dibagi rata satu putaran, mulai dari 0 derajat", () => {
    const chars = badgeRingChars("AB");
    // "AB • " = 5 huruf -> 72 derajat per huruf.
    expect(chars.map((item) => item.char).join("")).toBe("AB • ");
    expect(chars.map((item) => item.angle)).toEqual([0, 72, 144, 216, 288]);
  });
});

describe("formatIndex", () => {
  it("dua digit", () => {
    expect(formatIndex(1)).toBe("01");
    expect(formatIndex(12)).toBe("12");
    expect(formatIndex(120)).toBe("120");
  });
});

describe("imageStackSlots", () => {
  it("tanpa gambar = tanpa slot", () => {
    expect(imageStackSlots(0)).toEqual([]);
  });

  it("satu gambar memenuhi kotak", () => {
    expect(imageStackSlots(1)).toEqual(["single"]);
  });

  it("dua dan tiga gambar memakai posisi kolase, maksimal tiga", () => {
    expect(imageStackSlots(2)).toEqual(["back", "front"]);
    expect(imageStackSlots(3)).toEqual(["back", "front", "low"]);
    expect(imageStackSlots(5)).toEqual(["back", "front", "low"]);
  });
});
