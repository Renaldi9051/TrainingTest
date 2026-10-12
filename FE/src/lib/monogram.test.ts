import { describe, expect, it } from "vitest";
import { monogramInitial } from "./monogram";

describe("monogramInitial", () => {
  it("huruf pertama nama situs, huruf besar", () => {
    expect(monogramInitial("lembaga Pelatihan Contoh")).toBe("L");
  });

  it("melewati tanda baca dan spasi di depan; angka boleh", () => {
    expect(monogramInitial("  [UJI] Akademi")).toBe("U");
    expect(monogramInitial("3M Training")).toBe("3");
  });

  it("tanpa huruf/angka: kosong", () => {
    expect(monogramInitial("")).toBe("");
    expect(monogramInitial("--")).toBe("");
  });
});
