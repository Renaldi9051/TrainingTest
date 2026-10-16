import { describe, expect, it } from "vitest";
import { groupIndexItems, indexLetter } from "@/lib/index-groups";

const item = (label: string) => ({ label, href: `/x/${label}` });

describe("indexLetter", () => {
  it("huruf awal tanpa aksen, uppercase", () => {
    expect(indexLetter("akuntansi")).toBe("A");
    expect(indexLetter("Édition")).toBe("E");
  });

  it("selain huruf masuk #", () => {
    expect(indexLetter("3D Modeling")).toBe("#");
    expect(indexLetter("")).toBe("#");
  });
});

describe("groupIndexItems", () => {
  it("dikelompokkan per huruf, urut abjad, # paling akhir", () => {
    const groups = groupIndexItems([item("Pilot Drone"), item("3D Printing"), item("audit"), item("Akuntansi"), item("Perpajakan")]);
    expect(groups.map((group) => group.letter)).toEqual(["A", "P", "#"]);
    expect(groups[0].items.map((entry) => entry.label)).toEqual(["Akuntansi", "audit"]);
    expect(groups[1].items.map((entry) => entry.label)).toEqual(["Perpajakan", "Pilot Drone"]);
  });

  it("menyaring semua kata (urutan bebas), tanpa beda huruf & aksen", () => {
    const items = [item("Pilot Drone Dasar"), item("Pemetaan Udara"), item("Drone Pertanian")];
    expect(groupIndexItems(items, "drone").flatMap((group) => group.items.map((entry) => entry.label))).toEqual([
      "Drone Pertanian",
      "Pilot Drone Dasar",
    ]);
    expect(groupIndexItems(items, "  DASAR   drone ")).toEqual([{ letter: "P", items: [items[0]] }]);
  });

  it("tanpa hasil = daftar kosong", () => {
    expect(groupIndexItems([item("Audit")], "zzz")).toEqual([]);
  });
});
