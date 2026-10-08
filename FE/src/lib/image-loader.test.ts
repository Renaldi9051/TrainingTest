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
});
