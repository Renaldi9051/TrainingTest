// Daftar file upload di disk, dipakai scripts/sync-uploads-r2.ts.
import { readdir } from "node:fs/promises";
import path from "node:path";
import { contentTypeFor, isSafeRelativePath } from "../src/lib/storage";

// Path relatif ("/") semua file di bawah root yang memang ditulis pipeline upload (webp, svg, pdf),
// terurut. File lain (mis. .DS_Store, sisa sementara) dilewati.
export async function collectUploadFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => path.relative(root, path.join(entry.parentPath, entry.name)).split(path.sep).join("/"))
    .filter((relativePath) => isSafeRelativePath(relativePath) && contentTypeFor(relativePath) !== null)
    .sort();
}
