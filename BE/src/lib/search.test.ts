import { describe, expect, it } from "vitest";
import {
  collectTextValues,
  foldText,
  likeContainsPattern,
  matchSnippet,
  normalizeSearchText,
  searchTokens,
  toPrefixTsQuery,
  wholeWordRegex,
} from "@/lib/search";

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

describe("foldText & likeContainsPattern", () => {
  it("huruf kecil tanpa aksen, tanda baca (email/nomor) tetap", () => {
    expect(foldText("  Café  Bandung ")).toBe("cafe bandung");
    expect(foldText("Info@Contoh.ID")).toBe("info@contoh.id");
  });

  it("wildcard pengguna di-escape supaya % dan _ dicari apa adanya", () => {
    expect(likeContainsPattern("Diskon 50%")).toBe(String.raw`%diskon 50\%%`);
    expect(likeContainsPattern("file_name")).toBe(String.raw`%file\_name%`);
    expect(likeContainsPattern(String.raw`a\b`)).toBe(String.raw`%a\\b%`);
  });
});

describe("wholeWordRegex", () => {
  it("kata kunci di-fold dan karakter regex di-escape; batas kata = bukan huruf/angka", () => {
    expect(wholeWordRegex(" Pemetaan  Udara ")).toBe("(^|[^[:alnum:]])pemetaan udara($|[^[:alnum:]])");
    expect(wholeWordRegex("Café")).toBe("(^|[^[:alnum:]])cafe($|[^[:alnum:]])");
    expect(wholeWordRegex("C++ (dasar)")).toBe(String.raw`(^|[^[:alnum:]])c\+\+ \(dasar\)($|[^[:alnum:]])`);
  });

  it("pola setara regex JS: cocok kata utuh saja", () => {
    const js = (keyword: string) =>
      new RegExp(wholeWordRegex(keyword).replaceAll("[:alnum:]", String.raw`\p{L}\p{N}`), "u");
    expect(js("drone").test("training pemetaan udara menggunakan drone multirotor")).toBe(true);
    expect(js("drone").test("drone & survey")).toBe(true);
    expect(js("drone").test("dronestore")).toBe(false);
    expect(js("survey").test("surveyor tambang")).toBe(false);
    expect(js("c++").test("pemrograman c++ dasar")).toBe(true);
  });
});

describe("collectTextValues", () => {
  it("hanya nilai string konten: nama node rich text, attrs, id, href, enum, dan *Id dilewati", () => {
    const blocks = [
      {
        id: "b1",
        type: "RICH_TEXT",
        heading: "Ketentuan umum",
        body: {
          type: "doc",
          content: [{ type: "paragraph", content: [{ type: "text", text: "Isi paragraf", marks: [{ type: "link", attrs: { href: "/x" } }] }] }],
        },
      },
      { type: "IMAGE", imageId: "m1", caption: "Foto kelas", style: "chips", items: ["Satu", "  "] },
    ];
    expect(collectTextValues(blocks)).toEqual(["Ketentuan umum", "Isi paragraf", "Foto kelas", "Satu"]);
  });
});

describe("matchSnippet", () => {
  it("null kalau tidak cocok; teks pendek utuh; teks panjang dipotong di sekitar kecocokan", () => {
    expect(matchSnippet("Pelatihan pilot", "kamera")).toBeNull();
    expect(matchSnippet("Pelatihan  pilot drone", "PILOT")).toBe("Pelatihan pilot drone");
    const long = `${"awal ".repeat(30)}kata kunci di tengah${" akhir".repeat(30)}`;
    const snippet = matchSnippet(long, "kunci", 40);
    expect(snippet).toContain("kunci");
    expect(snippet?.startsWith("…")).toBe(true);
    expect(snippet?.endsWith("…")).toBe(true);
  });

  it("cocok tanpa memperhatikan aksen", () => {
    expect(matchSnippet("Kafé di Jakarta", "kafe")).toBe("Kafé di Jakarta");
  });
});
