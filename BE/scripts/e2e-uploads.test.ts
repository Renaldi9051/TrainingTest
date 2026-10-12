import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createE2eUploadDir, isE2eUploadDir, removeE2eUploadDir } from "./e2e-uploads";

// Memakai folder temp sendiri sebagai "temp OS" supaya test tidak menyentuh folder e2e sungguhan.
let tmp: string;
beforeEach(() => {
  tmp = mkdtempSync(path.join(os.tmpdir(), "e2e-uploads-test-"));
});
afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe("folder upload e2e", () => {
  it("membuat folder, lalu teardown menghapus folder itu beserta isinya dan penandanya", () => {
    const dir = createE2eUploadDir(tmp);
    mkdirSync(path.join(dir, "2026", "10"), { recursive: true });
    writeFileSync(path.join(dir, "2026", "10", "a.webp"), "x");
    const other = createE2eOtherDir();

    expect(removeE2eUploadDir(tmp)).toBe(dir);
    expect(existsSync(dir)).toBe(false);
    expect(existsSync(other)).toBe(true);
    // Penanda sudah dihapus: panggilan berikutnya tidak melakukan apa-apa.
    expect(removeE2eUploadDir(tmp)).toBeNull();
  });

  it("tanpa penanda: tidak menghapus apa pun", () => {
    expect(removeE2eUploadDir(tmp)).toBeNull();
  });

  it("menolak path di luar temp atau tanpa prefix e2e", () => {
    expect(isE2eUploadDir(path.join(tmp, "training-e2e-uploads-abc"), tmp)).toBe(true);
    expect(isE2eUploadDir(path.join(tmp, "training-e2e-uploads-"), tmp)).toBe(false);
    expect(isE2eUploadDir(path.join(tmp, "uploads"), tmp)).toBe(false);
    expect(isE2eUploadDir(path.join(tmp, "x", "training-e2e-uploads-abc"), tmp)).toBe(false);
    expect(isE2eUploadDir(path.join(tmp, "training-e2e-uploads-abc", ".."), tmp)).toBe(false);
    expect(isE2eUploadDir(tmp, tmp)).toBe(false);
  });

  it("penanda berisi path asing: ditolak, folder itu tidak dihapus", () => {
    const victim = path.join(tmp, "penting");
    mkdirSync(victim);
    writeFileSync(path.join(tmp, "training-e2e-upload-dir.txt"), victim);
    expect(() => removeE2eUploadDir(tmp)).toThrow(/bukan folder upload e2e/);
    expect(existsSync(victim)).toBe(true);
  });
});

function createE2eOtherDir(): string {
  const dir = path.join(tmp, "training-e2e-uploads-lain");
  mkdirSync(dir);
  return dir;
}
