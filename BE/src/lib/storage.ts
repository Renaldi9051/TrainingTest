import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { AwsClient } from "aws4fetch";
import { getEnv, type Env } from "@/lib/env";

// Semua path media di DB relatif terhadap root penyimpanan, selalu memakai "/" (mis. 2026/10/<uuid>.webp).
// Root penyimpanan: bucket Cloudflare R2 kalau variabel R2_* terisi, selain itu UPLOAD_DIR di disk.
// Path yang sama dipakai sebagai key objek R2, jadi data DB tidak berubah saat pindah penyimpanan.

export type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  // null = tanpa domain publik bucket: file dilayani BE lewat /uploads (diambil dari bucket).
  publicUrl: string | null;
};

// null = R2 tidak dipakai (semua R2_* kosong). Env sudah memastikan kredensial & bucket lengkap atau kosong.
export function r2Config(env: Env = getEnv()): R2Config | null {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_URL } = env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) return null;
  return {
    accountId: R2_ACCOUNT_ID,
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
    bucket: R2_BUCKET,
    publicUrl: R2_PUBLIC_URL ?? null,
  };
}

export function uploadRoot(): string {
  return path.resolve(getEnv().UPLOAD_DIR);
}

// Path relatif tanpa traversal: tanpa "\", null byte, awalan "/" atau drive, segmen kosong, ".", "..".
export function isSafeRelativePath(relativePath: string): boolean {
  if (!relativePath || relativePath.includes("\0") || relativePath.includes("\\")) return false;
  if (relativePath.startsWith("/") || /^[a-zA-Z]:/.test(relativePath)) return false;
  return relativePath.split("/").every((segment) => segment !== "" && segment !== "." && segment !== "..");
}

// Path aman di dalam root, atau null kalau mencoba keluar dari root (path traversal) atau tidak valid.
export function resolveUploadPath(relativePath: string, root = uploadRoot()): string | null {
  if (!isSafeRelativePath(relativePath)) return null;

  const resolved = path.resolve(root, ...relativePath.split("/"));
  const relative = path.relative(root, resolved);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) return null;
  return resolved;
}

// Folder per bulan: yyyy/mm (UTC).
export function monthFolder(now = new Date()): string {
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${now.getUTCFullYear()}/${month}`;
}

export async function saveUpload(relativePath: string, data: Uint8Array, config = r2Config()): Promise<void> {
  if (config) {
    await putR2Object(config, relativePath, data);
    return;
  }
  const target = resolveUploadPath(relativePath);
  if (!target) throw new Error(`Path upload tidak valid: ${relativePath}`);
  await mkdir(path.dirname(target), { recursive: true });
  // "wx": gagal kalau file sudah ada (nama acak, jadi seharusnya tidak pernah terjadi).
  await writeFile(target, data, { flag: "wx" });
}

// R2 dengan domain publik: URL absolut ke domain bucket. Selain itu /uploads/... yang dilayani route BE
// lewat rewrite FE (dari disk, atau diambil dari bucket kalau R2 tanpa domain publik).
export function uploadUrl(relativePath: string, config = r2Config()): string {
  return config?.publicUrl ? `${config.publicUrl}/${relativePath}` : `/uploads/${relativePath}`;
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

// ===== Cloudflare R2 (S3 API) =====

// Nama file acak dan tidak pernah ditimpa, jadi aman di-cache selamanya (sama dengan route /uploads).
const IMMUTABLE_CACHE = "public, max-age=31536000, immutable";

function r2ObjectUrl(config: R2Config, key: string): string {
  if (!isSafeRelativePath(key)) throw new Error(`Key objek R2 tidak valid: ${key}`);
  const encodedKey = key.split("/").map(encodeURIComponent).join("/");
  return `https://${config.accountId}.r2.cloudflarestorage.com/${encodeURIComponent(config.bucket)}/${encodedKey}`;
}

function r2Client(config: R2Config): AwsClient {
  return new AwsClient({
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    service: "s3",
    region: "auto",
  });
}

// Header objek yang ikut dilayani R2 ke browser.
export function r2ObjectHeaders(key: string): Record<string, string> {
  const contentType = contentTypeFor(key);
  if (!contentType) throw new Error(`Jenis file tidak didukung untuk R2: ${key}`);
  const headers: Record<string, string> = { "Content-Type": contentType, "Cache-Control": IMMUTABLE_CACHE };
  // R2 tidak bisa menyetel CSP per objek seperti route /uploads. Lapisan kedua setelah sanitasi:
  // SVG yang dibuka langsung diunduh, bukan dirender (tetap tampil normal lewat <img>).
  if (contentType === "image/svg+xml") headers["Content-Disposition"] = "attachment";
  if (contentType === "application/pdf") headers["Content-Disposition"] = "inline";
  return headers;
}

const NETWORK_ATTEMPTS = 3;

// aws4fetch sudah mengulang respons 5xx/429; ini mengulang error jaringan (koneksi timeout/putus) yang
// sesekali terjadi. Aman karena PUT/HEAD ke key yang sama idempoten.
async function r2Fetch(config: R2Config, key: string, init: RequestInit): Promise<Response> {
  const url = r2ObjectUrl(config, key);
  for (let attempt = 1; ; attempt++) {
    try {
      return await r2Client(config).fetch(url, init);
    } catch (error) {
      if (attempt >= NETWORK_ATTEMPTS) {
        const cause = error instanceof Error && error.cause instanceof Error ? `: ${error.cause.message}` : "";
        throw new Error(`Koneksi ke R2 gagal untuk ${key}${cause}`, { cause: error });
      }
      await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
    }
  }
}

export async function putR2Object(config: R2Config, key: string, data: Uint8Array): Promise<void> {
  const response = await r2Fetch(config, key, {
    method: "PUT",
    headers: r2ObjectHeaders(key),
    // Salinan ber-ArrayBuffer: BodyInit tidak menerima Uint8Array<ArrayBufferLike> (Buffer dari sharp).
    body: new Uint8Array(data),
  });
  if (!response.ok) {
    throw new Error(`Upload ke R2 gagal (${response.status}) untuk ${key}: ${await response.text()}`);
  }
}

// Objek untuk diteruskan route /uploads, atau null kalau tidak ada di bucket.
export async function getR2Object(config: R2Config, key: string): Promise<Response | null> {
  const response = await r2Fetch(config, key, { method: "GET" });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Ambil objek R2 gagal (${response.status}) untuk ${key}`);
  return response;
}

export async function r2ObjectExists(config: R2Config, key: string): Promise<boolean> {
  const response = await r2Fetch(config, key, { method: "HEAD" });
  if (response.status === 404) return false;
  if (!response.ok) throw new Error(`Cek objek R2 gagal (${response.status}) untuk ${key}`);
  return true;
}
