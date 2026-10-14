import { describe, expect, it } from "vitest";
import { focusOffset, MARQUEE_AUTO_SPEED, MARQUEE_MAX_SPEED, nextSpeed, wrapOffset } from "./marquee-plan";

describe("nextSpeed", () => {
  it("diam tanpa scroll", () => {
    expect(nextSpeed(0, 0)).toBe(0);
  });

  it("arah ikut scroll: ke bawah positif (geser kiri), ke atas negatif", () => {
    expect(nextSpeed(0, 40)).toBeGreaterThan(0);
    expect(nextSpeed(0, -40)).toBeLessThan(0);
  });

  it("dibatasi, lalu meluruh sampai berhenti setelah scroll berhenti", () => {
    let speed = 0;
    for (let i = 0; i < 20; i++) speed = nextSpeed(speed, 5000);
    expect(speed).toBeLessThanOrEqual(MARQUEE_MAX_SPEED);
    let frames = 0;
    while (speed !== 0 && frames < 500) {
      speed = nextSpeed(speed, 0);
      frames++;
    }
    expect(speed).toBe(0);
    expect(frames).toBeLessThan(120);
  });
});

describe("nextSpeed dengan laju dasar (logo klien berjalan sendiri)", () => {
  it("tanpa scroll tetap berjalan di laju dasar, ke kiri", () => {
    expect(nextSpeed(MARQUEE_AUTO_SPEED, 0, MARQUEE_AUTO_SPEED)).toBe(MARQUEE_AUTO_SPEED);
    expect(MARQUEE_AUTO_SPEED).toBeGreaterThan(0);
  });

  it("dari diam naik ke laju dasar; setelah scroll cepat atau ke atas kembali ke laju dasar", () => {
    for (const start of [0, MARQUEE_MAX_SPEED, -MARQUEE_MAX_SPEED]) {
      let speed = start;
      let frames = 0;
      while (speed !== MARQUEE_AUTO_SPEED && frames < 500) {
        speed = nextSpeed(speed, 0, MARQUEE_AUTO_SPEED);
        frames++;
      }
      expect(speed, String(start)).toBe(MARQUEE_AUTO_SPEED);
      expect(frames).toBeLessThan(120);
    }
  });

  it("scroll tetap mendorong dan menentukan arah", () => {
    expect(nextSpeed(MARQUEE_AUTO_SPEED, 400, MARQUEE_AUTO_SPEED)).toBeGreaterThan(MARQUEE_AUTO_SPEED);
    expect(nextSpeed(MARQUEE_AUTO_SPEED, -400, MARQUEE_AUTO_SPEED)).toBeLessThan(0);
  });
});

describe("wrapOffset", () => {
  it("selalu di (-half, 0]", () => {
    for (const x of [0, -10, -500, -1000, -1500, 30, 1200]) {
      const value = wrapOffset(x, 1000);
      expect(value).toBeLessThanOrEqual(0);
      expect(value).toBeGreaterThan(-1000);
    }
    expect(wrapOffset(-1250, 1000)).toBe(-250);
    expect(wrapOffset(100, 1000)).toBe(-900);
  });
});

describe("focusOffset", () => {
  it("elemen terfokus di tengah dan terlihat utuh, dibatasi ke salinan pertama", () => {
    // Kontainer 1000, isi satu salinan 2000.
    const x = focusOffset(1200, 200, 1000, 2000);
    expect(1200 + x).toBeGreaterThanOrEqual(0);
    expect(1200 + 200 + x).toBeLessThanOrEqual(1000);
    // Elemen di awal: tidak menggeser melewati 0.
    expect(focusOffset(0, 200, 1000, 2000)).toBe(0);
  });
});
