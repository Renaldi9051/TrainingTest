import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { IMAGE_ZOOM, REVEAL_FROM, revealDelay } from "./reveal-plan";
import { revealStart } from "./reveal-state";
import { scrambleFrame } from "./scramble";
import {
  DURATION,
  EASE,
  HERO_TOTAL_MS,
  HERO_WORD_MS,
  heroWordStepMs,
  IN_VIEW_MARGIN,
  STAGGER,
  STAGGER_CAP,
  staggerDelay,
} from "./tokens";

describe("token gerak", () => {
  it("easing sama dengan --ease-standard di theme.css", () => {
    const css = readFileSync(path.resolve(__dirname, "../../app/theme.css"), "utf8");
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

describe("rencana reveal", () => {
  it("keadaan awal hanya memakai opacity, transform, clip-path (DESIGN.md 8.3)", () => {
    for (const from of [...Object.values(REVEAL_FROM), IMAGE_ZOOM]) {
      expect(Object.keys(from).every((key) => ["opacity", "transform", "clipPath"].includes(key))).toBe(true);
    }
  });

  it("stagger per jenis: kata 50 ms, daftar 40 ms, kartu 80 ms + kolom kanan 60 ms, chip 50 ms", () => {
    expect(revealDelay("word", 2)).toBe(0.1);
    expect(revealDelay("item", 3)).toBe(0.12);
    expect(revealDelay("card", 1, 1)).toBe(0.14);
    expect(revealDelay("pop", 4)).toBe(0.2);
    // Garis & gambar tidak berbaris sendiri; kolom hanya berlaku untuk kartu.
    expect(revealDelay("line", 5)).toBe(0);
    expect(revealDelay("item", 1, 2)).toBe(0.04);
  });

  it("urutan stagger dibatasi supaya daftar panjang tidak menunggu lama", () => {
    expect(staggerDelay(STAGGER_CAP + 20, STAGGER.list)).toBe(staggerDelay(STAGGER_CAP, STAGGER.list));
    expect(revealDelay("card", 40, 2)).toBe(Number((STAGGER_CAP * STAGGER.card + 0.12).toFixed(3)));
  });
});

describe("headline hero", () => {
  it("kata terakhir selesai <= 500 ms, berapa pun jumlah katanya", () => {
    for (const count of [1, 2, 3, 6, 12, 30]) {
      expect((count - 1) * heroWordStepMs(count) + HERO_WORD_MS).toBeLessThanOrEqual(HERO_TOTAL_MS);
    }
  });

  it("jeda antar kata 50 ms untuk judul pendek, dipadatkan untuk judul panjang", () => {
    expect(heroWordStepMs(1)).toBe(0);
    expect(heroWordStepMs(3)).toBe(50);
    expect(heroWordStepMs(11)).toBe(10);
  });
});

describe("scrambleFrame", () => {
  const fixed = () => 0;

  it("bagian kiri tersusun sesuai progres, sisanya acak; spasi & tanda baca tetap", () => {
    expect(scrambleFrame("01 / LAYANAN", 0, fixed)).toBe("AA / AAAAAAA");
    expect(scrambleFrame("01 / LAYANAN", 0.5, fixed)).toBe("01 / LAAAAAA");
    expect(scrambleFrame("01 / LAYANAN", 1, fixed)).toBe("01 / LAYANAN");
  });

  it("panjang teks tidak berubah (font mono: tanpa geser layout)", () => {
    for (const progress of [0, 0.3, 0.9]) expect(scrambleFrame("Kategori · 2026", progress)).toHaveLength(15);
  });
});
