import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CAN_HOVER_QUERY, flipTransform, indicatorBox, magneticOffset } from "./pointer";
import { MAGNETIC_MAX_PX } from "./tokens";

const button = { left: 100, top: 50, width: 200, height: 48 };

describe("magneticOffset", () => {
  it("pusat elemen: tidak bergeser", () => {
    expect(magneticOffset({ x: 200, y: 74 }, button)).toEqual({ x: 0, y: 0 });
  });

  it("tepi elemen: maksimal 6 px (DESIGN.md 8.2), arah mengikuti kursor", () => {
    expect(MAGNETIC_MAX_PX).toBe(6);
    expect(magneticOffset({ x: 300, y: 98 }, button)).toEqual({ x: 6, y: 6 });
    expect(magneticOffset({ x: 100, y: 50 }, button)).toEqual({ x: -6, y: -6 });
  });

  it("sebanding dengan jarak dari pusat dan tidak pernah lebih dari batas", () => {
    expect(magneticOffset({ x: 250, y: 74 }, button)).toEqual({ x: 3, y: 0 });
    expect(magneticOffset({ x: 900, y: -400 }, button)).toEqual({ x: 6, y: -6 });
  });

  it("elemen berukuran 0 tidak menghasilkan NaN", () => {
    expect(magneticOffset({ x: 10, y: 10 }, { left: 10, top: 10, width: 0, height: 0 })).toEqual({ x: 0, y: 0 });
  });
});

describe("indicatorBox", () => {
  const chip = { left: 40, top: 8, width: 72, height: 32 };
  it("pill menutup elemen aktif", () => {
    expect(indicatorBox("pill", chip)).toEqual(chip);
  });
  it("line: garis 1 px tepat di bawah elemen aktif", () => {
    expect(indicatorBox("line", chip)).toEqual({ left: 40, top: 40, width: 72, height: 1 });
  });
  it("line: tebal garis bisa diatur (palet C: menu 2 px, tab 3 px), tetap tepat di bawah", () => {
    expect(indicatorBox("line", chip, 3)).toEqual({ left: 40, top: 40, width: 72, height: 3 });
    expect(indicatorBox("pill", chip, 3)).toEqual(chip);
  });
});

describe("flipTransform", () => {
  const to = { left: 120, top: 0, width: 80, height: 32 };
  it("posisi sama: tidak ada animasi", () => {
    expect(flipTransform(to, to)).toBeNull();
    expect(flipTransform({ ...to, left: 120.3 }, to)).toBeNull();
  });
  it("membalik posisi & ukuran baru ke posisi lama (hanya transform)", () => {
    expect(flipTransform({ left: 0, top: 0, width: 40, height: 32 }, to)).toBe("translate(-120px, 0px) scale(0.5, 1)");
    expect(flipTransform({ left: 200, top: 40, width: 80, height: 32 }, to)).toBe("translate(80px, 40px) scale(1, 1)");
  });
});

describe("CAN_HOVER_QUERY", () => {
  it("butuh hover + kursor presisi dan mati saat reduced motion (DESIGN.md 8.3)", () => {
    expect(CAN_HOVER_QUERY).toContain("(hover: hover)");
    expect(CAN_HOVER_QUERY).toContain("(pointer: fine)");
    expect(CAN_HOVER_QUERY).toContain("(prefers-reduced-motion: no-preference)");
  });

  it("variant CSS pointer-fine di theme.css memakai media query hover yang sama", () => {
    const css = readFileSync(path.resolve(__dirname, "../../app/theme.css"), "utf8");
    expect(css).toContain("@custom-variant pointer-fine (@media (hover: hover) and (pointer: fine));");
  });
});
