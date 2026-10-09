import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CATEGORY_ICON_NAMES } from "@/lib/category-icons";

// Penjaga sinkronisasi: daftar ikon FE harus sama dengan allowlist BE.
describe("CATEGORY_ICONS", () => {
  it("sama dengan allowlist di BE/src/lib/validators/category.ts", () => {
    const source = readFileSync(path.resolve(__dirname, "../../../BE/src/lib/validators/category.ts"), "utf8");
    const block = source.slice(source.indexOf("CATEGORY_ICONS = ["), source.indexOf("] as const"));
    const beNames = [...block.matchAll(/"([a-z0-9-]+)"/g)].map((match) => match[1]);
    expect(beNames.length).toBeGreaterThan(0);
    expect([...CATEGORY_ICON_NAMES].sort()).toEqual([...beNames].sort());
  });
});
