import { describe, expect, it } from "vitest";
import { parseAccentHeading } from "./accent-heading";

describe("parseAccentHeading", () => {
  it("kata di antara bintang jadi aksen", () => {
    expect(parseAccentHeading("Pelatihan untuk setiap *bidang* kerja")).toEqual({
      before: "Pelatihan untuk setiap ",
      accent: "bidang",
      after: " kerja",
    });
  });

  it("tanpa penanda: seluruh teks polos", () => {
    expect(parseAccentHeading("Katalog pelatihan")).toEqual({ before: "Katalog pelatihan", accent: "", after: "" });
  });

  it("hanya satu aksen; bintang sisa dan pasangan kosong dibuang", () => {
    expect(parseAccentHeading("*Satu* dan *dua*")).toEqual({ before: "", accent: "Satu", after: " dan dua" });
    expect(parseAccentHeading("Bintang * sendiri")).toEqual({ before: "Bintang  sendiri", accent: "", after: "" });
    expect(parseAccentHeading("Kosong ** di sini").accent).toBe("");
  });
});
