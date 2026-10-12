import { describe, expect, it } from "vitest";
import { collectMediaRefs } from "@/lib/media-refs";

describe("collectMediaRefs", () => {
  it("mencari key mediaId di semua tingkat beserta path-nya", () => {
    const value = {
      image: { mediaId: "m1" },
      nested: { list: [{ file: { mediaId: "m2" } }, { other: 1 }] },
      text: "mediaId",
      // Bukan string: dilewati.
      broken: { mediaId: 42 },
    };
    expect(collectMediaRefs(value)).toEqual([
      { path: "image", mediaId: "m1" },
      { path: "nested.list.0.file", mediaId: "m2" },
    ]);
  });

  it("array di akar memakai indeks sebagai awal path", () => {
    expect(collectMediaRefs([{ image: { mediaId: "a" } }, null, { file: { mediaId: "b" } }])).toEqual([
      { path: "0.image", mediaId: "a" },
      { path: "2.file", mediaId: "b" },
    ]);
  });

  it("nilai primitif atau null: tidak ada referensi", () => {
    expect(collectMediaRefs(null)).toEqual([]);
    expect(collectMediaRefs("mediaId")).toEqual([]);
  });
});
