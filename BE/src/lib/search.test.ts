import { describe, expect, it } from "vitest";
import { normalizeSearchText, searchTokens, toPrefixTsQuery } from "@/lib/search";

describe("normalizeSearchText", () => {
  it("lower, buang diakritik dan tanda baca", () => {
    expect(normalizeSearchText("  Akuntánsi & PAJAK!  ")).toBe("akuntansi pajak");
    expect(normalizeSearchText("ISO 9001:2015")).toBe("iso 9001 2015");
  });
});

describe("toPrefixTsQuery", () => {
  it("setiap kata jadi awalan dan digabung &", () => {
    expect(toPrefixTsQuery("laporan keu")).toBe("laporan:* & keu:*");
  });

  it("karakter operator tsquery tidak pernah lolos", () => {
    expect(toPrefixTsQuery("a & b | !c <-> d:* 'e'")).toBe("a:* & b:* & c:* & d:* & e:*");
    expect(toPrefixTsQuery("&|!()")).toBeNull();
  });

  it("kosong = null; maksimal 8 kata, tiap kata maks 40 karakter", () => {
    expect(toPrefixTsQuery("   ")).toBeNull();
    expect(searchTokens("a b c d e f g h i j")).toHaveLength(8);
    expect(searchTokens("x".repeat(100))[0]).toHaveLength(40);
  });
});
