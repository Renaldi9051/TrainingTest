import { describe, expect, it } from "vitest";
import mediaImageLoader from "@/lib/image-loader";

const src = "/uploads/2026/10/0199b4d0-0000-7000-8000-000000000001.webp";
const base = "/uploads/2026/10/0199b4d0-0000-7000-8000-000000000001";

describe("mediaImageLoader", () => {
  it.each([
    [160, `${base}-320.webp`],
    [320, `${base}-320.webp`],
    [321, `${base}-768.webp`],
    [768, `${base}-768.webp`],
    [1200, `${base}-1600.webp`],
    [1600, `${base}-1600.webp`],
  ])("lebar %i memakai varian yang cukup", (width, expected) => {
    expect(mediaImageLoader({ src, width })).toBe(expected);
  });

  it("lebih lebar dari varian terbesar memakai file utama", () => {
    expect(mediaImageLoader({ src, width: 2400 })).toBe(src);
  });

  it("tidak mengubah URL yang bukan WebP utama", () => {
    expect(mediaImageLoader({ src: "/uploads/2026/10/a.svg", width: 320 })).toBe("/uploads/2026/10/a.svg");
    expect(mediaImageLoader({ src: `${base}-768.webp`, width: 320 })).toBe(`${base}-768.webp`);
  });

  describe("URL absolut bucket R2", () => {
    const r2Base = "https://media.contoh.id/2026/10/0199b4d0-0000-7000-8000-000000000001";

    it("memakai varian di domain bucket yang sama", () => {
      expect(mediaImageLoader({ src: `${r2Base}.webp`, width: 320 })).toBe(`${r2Base}-320.webp`);
      expect(mediaImageLoader({ src: `${r2Base}.webp`, width: 1200 })).toBe(`${r2Base}-1600.webp`);
      expect(mediaImageLoader({ src: `${r2Base}.webp`, width: 2400 })).toBe(`${r2Base}.webp`);
    });

    it("bucket dengan prefix path juga dikenali", () => {
      const prefixed = "https://cdn.contoh.id/media/2026/10/0199b4d0-0000-7000-8000-000000000001";
      expect(mediaImageLoader({ src: `${prefixed}.webp`, width: 768 })).toBe(`${prefixed}-768.webp`);
    });

    it("tidak mengubah varian, SVG, atau URL luar yang bukan nama file media BE", () => {
      expect(mediaImageLoader({ src: `${r2Base}-768.webp`, width: 320 })).toBe(`${r2Base}-768.webp`);
      expect(mediaImageLoader({ src: "https://media.contoh.id/2026/10/a.svg", width: 320 })).toBe(
        "https://media.contoh.id/2026/10/a.svg",
      );
      expect(mediaImageLoader({ src: "https://contoh.id/foto.webp", width: 320 })).toBe("https://contoh.id/foto.webp");
    });
  });
});
