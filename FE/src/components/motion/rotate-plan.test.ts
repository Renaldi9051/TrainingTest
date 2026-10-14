import { describe, expect, it } from "vitest";
import { nextRotateIndex, shouldRotate, type RotateBlockers } from "./rotate-plan";
import { ROTATE_INTERVAL_MS } from "./tokens";

const free: RotateBlockers = { paused: false, hovered: false, hidden: false, offscreen: false };

describe("kata berganti di hero", () => {
  it("tiap 3 detik", () => {
    expect(ROTATE_INTERVAL_MS).toBe(3000);
  });

  it("berulang terus: setelah kata terakhir kembali ke kata pertama", () => {
    const sequence = [0];
    for (let step = 0; step < 5; step += 1) sequence.push(nextRotateIndex(sequence[step], 3));
    expect(sequence).toEqual([0, 1, 2, 0, 1, 2]);
    expect(nextRotateIndex(0, 0)).toBe(0);
  });

  it("hanya berganti kalau kata > 1 dan tidak ada yang menahan", () => {
    expect(shouldRotate(3, free)).toBe(true);
    expect(shouldRotate(1, free)).toBe(false);
    for (const key of ["paused", "hovered", "hidden", "offscreen"] as const) {
      expect(shouldRotate(3, { ...free, [key]: true }), key).toBe(false);
    }
  });
});
