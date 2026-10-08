import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { getEnv } from "@/lib/env";

// Semua path media di DB relatif terhadap UPLOAD_DIR, selalu memakai "/" (mis. 2026/10/<uuid>.webp).

export function uploadRoot(): string {
  return path.resolve(getEnv().UPLOAD_DIR);
}

// Path aman di dalam root, atau null kalau mencoba keluar dari root (path traversal) atau tidak valid.
export function resolveUploadPath(relativePath: string, root = uploadRoot()): string | null {
  if (!relativePath || relativePath.includes("\0") || relativePath.includes("\\")) return null;
  if (relativePath.startsWith("/") || /^[a-zA-Z]:/.test(relativePath)) return null;

  const segments = relativePath.split("/");
  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
    return null;
  }

  const resolved = path.resolve(root, ...segments);
  const relative = path.relative(root, resolved);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) return null;
  return resolved;
}

// Folder per bulan: yyyy/mm (UTC).
export function monthFolder(now = new Date()): string {
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${now.getUTCFullYear()}/${month}`;
}

export async function saveUpload(relativePath: string, data: Uint8Array): Promise<void> {
  const target = resolveUploadPath(relativePath);
  if (!target) throw new Error(`Path upload tidak valid: ${relativePath}`);
  await mkdir(path.dirname(target), { recursive: true });
  // "wx": gagal kalau file sudah ada (nama acak, jadi seharusnya tidak pernah terjadi).
  await writeFile(target, data, { flag: "wx" });
}

export function uploadUrl(relativePath: string): string {
  return `/uploads/${relativePath}`;
}

const CONTENT_TYPES: Record<string, string> = {
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
};

// Hanya ekstensi yang memang ditulis oleh pipeline upload yang dilayani.
export function contentTypeFor(filePath: string): string | null {
  return CONTENT_TYPES[path.extname(filePath).toLowerCase()] ?? null;
}
