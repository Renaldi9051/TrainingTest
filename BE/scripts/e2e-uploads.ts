// Folder upload sementara server BE e2e (scripts/e2e-dev.ts). Path-nya dicatat di file penanda
// di temp OS supaya global teardown Playwright (FE/e2e/global-teardown.ts) bisa menghapus folder
// miliknya sendiri saja, bukan folder lain di temp.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

export const E2E_UPLOAD_PREFIX = "training-e2e-uploads-";
const MARKER_NAME = "training-e2e-upload-dir.txt";

const markerFile = (tmp: string) => path.join(tmp, MARKER_NAME);

// Buat folder upload baru dan catat path-nya.
export function createE2eUploadDir(tmp = os.tmpdir()): string {
  const dir = mkdtempSync(path.join(tmp, E2E_UPLOAD_PREFIX));
  writeFileSync(markerFile(tmp), dir, "utf8");
  return dir;
}

// Hanya folder langsung di temp OS yang namanya berawalan prefix e2e (plus akhiran acak).
export function isE2eUploadDir(dir: string, tmp = os.tmpdir()): boolean {
  const resolved = path.resolve(dir);
  const name = path.basename(resolved);
  return path.dirname(resolved) === path.resolve(tmp) && name.startsWith(E2E_UPLOAD_PREFIX) && name.length > E2E_UPLOAD_PREFIX.length;
}

// Hapus folder yang tercatat di penanda, lalu penandanya. null kalau tidak ada penanda.
export function removeE2eUploadDir(tmp = os.tmpdir()): string | null {
  let dir: string;
  try {
    dir = readFileSync(markerFile(tmp), "utf8").trim();
  } catch {
    return null;
  }
  if (!isE2eUploadDir(dir, tmp)) throw new Error(`Menolak menghapus "${dir}": bukan folder upload e2e di temp OS.`);
  rmSync(dir, { recursive: true, force: true });
  rmSync(markerFile(tmp), { force: true });
  return dir;
}
