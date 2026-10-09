import { describe, expect, it } from "vitest";
import { diffFields } from "@/services/audit";

describe("diffFields", () => {
  it("hanya mencatat field yang berubah", () => {
    const before = { title: "A", summary: "S", featured: false, order: 1 };
    const after = { title: "B", summary: "S", featured: true, order: 1 };
    expect(diffFields(before, after, ["title", "summary", "featured", "order"])).toEqual({
      title: { from: "A", to: "B" },
      featured: { from: false, to: true },
    });
  });

  it("membandingkan Date, array, dan objek lewat bentuk JSON", () => {
    const date = new Date("2026-10-01T00:00:00.000Z");
    const before = { publishedAt: date, types: ["PUBLIC"], body: { type: "doc", content: [] } };
    const same = {
      publishedAt: new Date(date),
      types: ["PUBLIC"],
      body: { type: "doc", content: [] },
    };
    expect(diffFields(before, same, ["publishedAt", "types", "body"])).toEqual({});
    expect(diffFields(before, { ...same, types: ["PUBLIC", "IN_HOUSE"] }, ["types"])).toEqual({
      types: { from: ["PUBLIC"], to: ["PUBLIC", "IN_HOUSE"] },
    });
  });

  it("before null (create) mencatat semua field yang terisi", () => {
    expect(diffFields(null, { name: "X", icon: null }, ["name", "icon"])).toEqual({
      name: { from: null, to: "X" },
    });
  });
});
