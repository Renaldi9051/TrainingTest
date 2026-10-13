import { describe, expect, it } from "vitest";
import { rotateSchedule } from "./rotate-plan";
import { ROTATE_INTERVAL_MS, ROTATE_SWAP_MS, ROTATE_TOTAL_MS } from "./tokens";

describe("rotateSchedule", () => {
  it("satu kata: tidak berganti", () => {
    expect(rotateSchedule(0)).toEqual([]);
    expect(rotateSchedule(1)).toEqual([]);
  });

  it("dua kata: tiap 2,2 s, satu putaran lalu kembali ke kata pertama", () => {
    expect(rotateSchedule(2)).toEqual([
      { at: ROTATE_INTERVAL_MS, from: 0, to: 1 },
      { at: ROTATE_INTERVAL_MS * 2, from: 1, to: 0 },
    ]);
  });

  it("selesai <= 5 s berapa pun jumlah katanya, berakhir di kata pertama", () => {
    for (const count of [2, 3, 4, 6, 10]) {
      const steps = rotateSchedule(count);
      expect(steps).toHaveLength(count);
      expect(steps.at(-1)?.to).toBe(0);
      expect((steps.at(-1)?.at ?? 0) + ROTATE_SWAP_MS).toBeLessThanOrEqual(ROTATE_TOTAL_MS);
    }
  });
});
