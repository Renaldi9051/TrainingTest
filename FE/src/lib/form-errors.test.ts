import { describe, expect, it } from "vitest";
import { indexesFromFieldKeys, indexesFromFormErrors } from "@/lib/form-errors";

describe("indexesFromFieldKeys", () => {
  it("prefix bertingkat (content.items) -> index baris, unik & terurut", () => {
    expect(
      indexesFromFieldKeys("content.items", [
        "content.items.3.label",
        "content.items.0.value",
        "content.items.3.value",
        "content.items",
        "content.heading",
        "content.itemsX.1.label",
      ]),
    ).toEqual([0, 3]);
  });

  it("prefix dengan karakter regex tidak dianggap pola", () => {
    expect(indexesFromFieldKeys("content.rotatingWords", ["contentXrotatingWords.1", "content.rotatingWords.2"])).toEqual([2]);
  });
});

describe("indexesFromFormErrors", () => {
  it("array jarang & objek ber-index", () => {
    const sparse: unknown[] = [];
    sparse[4] = { label: { message: "x" } };
    expect(indexesFromFormErrors(sparse)).toEqual([4]);
    expect(indexesFromFormErrors({ 2: { value: {} }, root: {} })).toEqual([2]);
    expect(indexesFromFormErrors(null)).toEqual([]);
  });
});
