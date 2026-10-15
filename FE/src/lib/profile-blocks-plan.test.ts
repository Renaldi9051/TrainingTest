import { describe, expect, it } from "vitest";
import type { PublicPageBlock } from "@/lib/api/types";
import { outlineLabel } from "@/lib/outline-label";
import { groupProfileBlocks } from "@/lib/profile-blocks-plan";

const list = (id: string): PublicPageBlock => ({ id, type: "LIST", style: "bullet", eyebrow: "", heading: id, items: ["a"] });
const text = (id: string): PublicPageBlock => ({ id, type: "RICH_TEXT", eyebrow: "", heading: id, bodyHtml: "<p>x</p>" });

describe("groupProfileBlocks", () => {
  it("urutan dijaga; dua daftar berurutan digabung, daftar ketiga berdiri sendiri", () => {
    const items = groupProfileBlocks([text("t"), list("a"), list("b"), list("c"), text("u")]);
    expect(items.map((item) => (item.kind === "lists" ? item.lists.map((block) => block.id).join("+") : item.block.id))).toEqual([
      "t",
      "a+b",
      "c",
      "u",
    ]);
  });

  it("daftar yang tidak berurutan tidak digabung", () => {
    expect(groupProfileBlocks([list("a"), text("t"), list("b")]).every((item) => item.kind === "block")).toBe(true);
  });
});

describe("outlineLabel", () => {
  it("nomor urut eyebrow dibuang", () => {
    expect(outlineLabel("04 / Keunggulan")).toBe("Keunggulan");
    expect(outlineLabel("Keunggulan")).toBe("Keunggulan");
  });
});
