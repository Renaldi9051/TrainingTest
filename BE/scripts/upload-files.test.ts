import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { collectUploadFiles } from "./upload-files";

let root: string;
beforeEach(() => {
  root = mkdtempSync(path.join(os.tmpdir(), "upload-files-test-"));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("collectUploadFiles", () => {
  it("mengembalikan path relatif bergaris miring untuk file buatan pipeline upload saja", async () => {
    mkdirSync(path.join(root, "2026", "10"), { recursive: true });
    mkdirSync(path.join(root, "2026", "09"), { recursive: true });
    for (const name of ["a.webp", "a-320.webp", "logo.svg", "doc.pdf", ".DS_Store", "tmp.jpg"]) {
      writeFileSync(path.join(root, "2026", "10", name), "x");
    }
    writeFileSync(path.join(root, "2026", "09", "b.webp"), "x");

    expect(await collectUploadFiles(root)).toEqual([
      "2026/09/b.webp",
      "2026/10/a-320.webp",
      "2026/10/a.webp",
      "2026/10/doc.pdf",
      "2026/10/logo.svg",
    ]);
  });
});
