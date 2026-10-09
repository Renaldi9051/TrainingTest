import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import * as limits from "@/lib/training-content";

// Penjaga sinkronisasi batas konten FE dengan BE.
describe("batas konten pelatihan", () => {
  it("sama dengan BE/src/lib/validators/training-content.ts", () => {
    const source = readFileSync(
      path.resolve(__dirname, "../../../BE/src/lib/validators/training-content.ts"),
      "utf8",
    );
    for (const [name, value] of Object.entries(limits)) {
      expect(source, name).toMatch(new RegExp(`export const ${name} = ${value};`));
    }
  });
});
