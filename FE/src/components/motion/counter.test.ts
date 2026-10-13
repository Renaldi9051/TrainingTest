import { describe, expect, it } from "vitest";
import { counterValue } from "./counter";
import { COUNTER_MS } from "./tokens";

describe("counterValue", () => {
  it("mulai 0, selesai tepat di nilai final pada 900 ms", () => {
    expect(COUNTER_MS).toBe(900);
    expect(counterValue(1200, 0)).toBe(0);
    expect(counterValue(1200, COUNTER_MS)).toBe(1200);
    expect(counterValue(1200, COUNTER_MS + 500)).toBe(1200);
  });

  it("ease-out cubic: separuh waktu sudah 87,5% nilai, naik monoton", () => {
    expect(counterValue(1000, COUNTER_MS / 2)).toBe(875);
    let previous = -1;
    for (let t = 0; t <= COUNTER_MS; t += 30) {
      const value = counterValue(48, t);
      expect(value).toBeGreaterThanOrEqual(previous);
      expect(value).toBeLessThanOrEqual(48);
      previous = value;
    }
  });
});
