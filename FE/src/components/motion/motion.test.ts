import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { revealStart } from "./reveal-state";
import { DURATION, EASE, IN_VIEW_MARGIN, STAGGER, staggerDelay } from "./tokens";

describe("token gerak", () => {
  it("easing sama dengan --ease-standard di globals.css", () => {
    const css = readFileSync(path.resolve(__dirname, "../../app/globals.css"), "utf8");
    const match = /--ease-standard:\s*cubic-bezier\(([^)]+)\)/.exec(css);
    expect(match?.[1].split(",").map(Number)).toEqual([...EASE]);
  });

  it("durasi, stagger, dan margin viewport mengikuti DESIGN.md 8", () => {
    expect(DURATION).toEqual({ fast: 0.15, normal: 0.3, slow: 0.6 });
    expect(STAGGER).toEqual({ list: 0.04, word: 0.05, card: 0.08, chip: 0.05 });
    expect(IN_VIEW_MARGIN).toBe("0px 0px -10% 0px");
  });

  it("staggerDelay: urutan x langkah + kolom kanan sedikit lebih lambat", () => {
    expect(staggerDelay(0, STAGGER.card)).toBe(0);
    expect(staggerDelay(3, STAGGER.list)).toBe(0.12);
    expect(staggerDelay(2, STAGGER.card, 2)).toBe(0.28);
  });
});

describe("revealStart", () => {
  const base = { viewportHeight: 800, reducedMotion: false, supportsObserver: true };

  it("elemen di layar pertama tidak pernah disembunyikan", () => {
    expect(revealStart({ ...base, top: 0 })).toBe("static");
    expect(revealStart({ ...base, top: 799 })).toBe("static");
    // Sudah di-scroll melewati elemen (top negatif): tetap terlihat.
    expect(revealStart({ ...base, top: -300 })).toBe("static");
  });

  it("elemen yang seluruhnya di bawah layar awal disiapkan untuk reveal", () => {
    expect(revealStart({ ...base, top: 800 })).toBe("hidden");
    expect(revealStart({ ...base, top: 2400 })).toBe("hidden");
  });

  it("reduced motion atau tanpa IntersectionObserver: konten final langsung", () => {
    expect(revealStart({ ...base, top: 2400, reducedMotion: true })).toBe("static");
    expect(revealStart({ ...base, top: 2400, supportsObserver: false })).toBe("static");
  });
});
