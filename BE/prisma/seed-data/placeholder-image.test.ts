import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { PLACEHOLDER_GRAYS, placeholderPng, placeholderSvg, prng } from "./placeholder-image";
import { plannedMediaCount } from "./seed-images";

describe("gambar placeholder", () => {
  it("deterministik: seed sama = SVG sama, seed beda = komposisi beda", () => {
    expect(placeholderSvg(7)).toBe(placeholderSvg(7));
    expect(placeholderSvg(7)).not.toBe(placeholderSvg(8));
    expect(prng(1)()).toBe(prng(1)());
  });

  it("monokrom datar: hanya abu dari palet, tanpa gradasi (DESIGN 2 & 5)", () => {
    for (const seed of [1, 2, 3, 1001, 3007]) {
      const svg = placeholderSvg(seed);
      expect(svg).not.toMatch(/gradient|<image|href=/i);
      const colors = new Set(svg.match(/#[0-9a-f]{6}/gi));
      for (const color of colors) expect(PLACEHOLDER_GRAYS).toContain(color.toLowerCase());
    }
  });

  it("PNG 4:3 grayscale (R = G = B) dan deterministik termasuk noise", async () => {
    const [a, b] = await Promise.all([placeholderPng(5, 160, 120), placeholderPng(5, 160, 120)]);
    expect(a.equals(b)).toBe(true);
    const { data, info } = await sharp(a).raw().toBuffer({ resolveWithObject: true });
    expect([info.width, info.height]).toEqual([160, 120]);
    for (let offset = 0; offset < data.length; offset += info.channels * 97) {
      if (info.channels >= 3) {
        expect(data[offset]).toBe(data[offset + 1]);
        expect(data[offset]).toBe(data[offset + 2]);
      }
    }
  });

  it("jumlah media: 1 per layanan, 2 per portofolio", () => {
    const rows = (count: number) => Array.from({ length: count }, (_, index) => ({ id: String(index), title: `T${index}` }));
    expect(plannedMediaCount({ services: rows(4), portfolio: rows(6) })).toBe(4 + 12);
    expect(plannedMediaCount({ services: [], portfolio: [] })).toBe(0);
  });
});
