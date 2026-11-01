import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import { BlockList, isIP, type LookupFunction } from "node:net";
import { MAX_UPLOAD_BYTES } from "@/lib/file-type";
import { HttpError } from "@/lib/http";

// Mengunduh gambar dari URL luar untuk media library (impor gambar artikel). Karena server yang
// mengambil URL kiriman admin, semua alamat jaringan internal ditolak (cegah SSRF):
// - hanya http/https di port bawaan, tanpa user:password di URL;
// - IP hasil DNS dicek di dalam lookup socket itu sendiri, jadi DNS yang berganti jawaban di antara
//   cek dan koneksi (DNS rebinding) tetap tertolak; host berupa IP literal dicek terpisah karena
//   Node tidak memanggil lookup untuk IP literal;
// - redirect diikuti manual (maks MAX_REDIRECTS) dan tiap URL tujuan dicek ulang;
// - ukuran dibatasi saat streaming dan ada batas waktu total.

const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 15_000;
const BLOCKED_CODE = "EBLOCKEDADDRESS";

// Dua daftar terpisah: BlockList mencocokkan alamat IPv4 juga ke subnet IPv6 (sebagai IPv4-mapped),
// sehingga aturan ::ffff:0:0/96 di daftar gabungan akan memblokir semua IPv4.
const blockedV4 = new BlockList();
const blockedV6 = new BlockList();
const BLOCKED_V4: [string, number][] = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
];
const BLOCKED_V6: [string, number][] = [
  // ::, ::1, dan alamat IPv4-compatible.
  ["::", 96],
  // IPv4-mapped (::ffff:a.b.c.d): bisa menyelundupkan alamat IPv4 privat.
  ["::ffff:0:0", 96],
  ["64:ff9b::", 96],
  ["64:ff9b:1::", 48],
  ["100::", 64],
  ["2001::", 23],
  ["2001:db8::", 32],
  ["2002::", 16],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
];
for (const [network, prefix] of BLOCKED_V4) blockedV4.addSubnet(network, prefix, "ipv4");
for (const [network, prefix] of BLOCKED_V6) blockedV6.addSubnet(network, prefix, "ipv6");

// true = alamat privat/khusus atau bukan IP sama sekali.
export function isBlockedAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return blockedV4.check(address, "ipv4");
  if (family === 6) return blockedV6.check(address, "ipv6");
  return true;
}

export type RemoteImageOptions = {
  maxBytes?: number;
  timeoutMs?: number;
  // Hanya untuk test (server lokal di port acak); produksi selalu memakai nilai bawaan.
  isBlocked?: (address: string) => boolean;
  allowAnyPort?: boolean;
};

export type RemoteImage = { data: Uint8Array; name: string };

function importError(code: string, message: string): HttpError {
  return new HttpError(422, code, message, { url: [message] });
}

const BLOCKED_MESSAGE = "URL ini tidak diizinkan. Gunakan alamat gambar publik di internet.";

function checkUrl(url: URL, isBlocked: (address: string) => boolean, allowAnyPort: boolean): void {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw importError("INVALID_URL", "URL harus diawali http:// atau https://.");
  }
  if (url.username || url.password) throw importError("URL_NOT_ALLOWED", BLOCKED_MESSAGE);
  // Port bawaan saja: mencegah URL dipakai untuk memindai layanan di port lain.
  if (url.port !== "" && !allowAnyPort) throw importError("URL_NOT_ALLOWED", BLOCKED_MESSAGE);
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host) && isBlocked(host)) throw importError("URL_NOT_ALLOWED", BLOCKED_MESSAGE);
}

function safeLookup(isBlocked: (address: string) => boolean): LookupFunction {
  return (hostname, options, callback) => {
    dns.lookup(hostname, { ...options, all: true }, (error, addresses) => {
      if (error) return callback(error, "", 4);
      const list = addresses as dns.LookupAddress[];
      if (list.length === 0 || list.some((entry) => isBlocked(entry.address))) {
        const blocked: NodeJS.ErrnoException = new Error(`Alamat ${hostname} diblokir.`);
        blocked.code = BLOCKED_CODE;
        return callback(blocked, "", 4);
      }
      if (options.all) return callback(null, list);
      const first = list[0];
      return callback(null, first.address, first.family);
    });
  };
}

type Response = { status: number; location: string | null; contentType: string | null; body: Uint8Array | null };

function requestOnce(
  url: URL,
  lookup: LookupFunction,
  signal: AbortSignal,
  maxBytes: number,
): Promise<Response> {
  const client = url.protocol === "https:" ? https : http;
  return new Promise((resolve, reject) => {
    const request = client.get(
      url,
      {
        lookup,
        signal,
        headers: { "User-Agent": "TrainingCMS-ImageImport/1.0", Accept: "image/*" },
      },
      (response) => {
        const status = response.statusCode ?? 0;
        const location = typeof response.headers.location === "string" ? response.headers.location : null;
        const contentType = response.headers["content-type"] ?? null;
        if (status !== 200) {
          response.resume();
          resolve({ status, location, contentType, body: null });
          return;
        }
        const declared = Number(response.headers["content-length"] ?? 0);
        if (declared > maxBytes) {
          response.destroy();
          reject(tooLarge(maxBytes));
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        response.on("data", (chunk: Buffer) => {
          size += chunk.byteLength;
          if (size > maxBytes) {
            response.destroy();
            reject(tooLarge(maxBytes));
            return;
          }
          chunks.push(chunk);
        });
        response.on("end", () =>
          resolve({ status, location, contentType, body: new Uint8Array(Buffer.concat(chunks)) }),
        );
        response.on("error", reject);
      },
    );
    request.on("error", reject);
  });
}

function tooLarge(maxBytes: number): HttpError {
  return importError("FILE_TOO_LARGE", `Ukuran gambar maksimal ${Math.round(maxBytes / (1024 * 1024))} MB.`);
}

function fileNameFrom(url: URL): string {
  const last = url.pathname.split("/").filter(Boolean).at(-1) ?? "";
  let name: string;
  try {
    name = decodeURIComponent(last);
  } catch {
    name = last;
  }
  return name.slice(0, 200) || "gambar-url";
}

function mapNetworkError(error: unknown): HttpError {
  if (error instanceof HttpError) return error;
  const code = (error as NodeJS.ErrnoException | null)?.code;
  const name = (error as Error | null)?.name;
  if (code === BLOCKED_CODE) return importError("URL_NOT_ALLOWED", BLOCKED_MESSAGE);
  if (name === "AbortError" || name === "TimeoutError" || code === "ABORT_ERR") {
    return importError("REMOTE_TIMEOUT", "Server gambar terlalu lama merespons. Coba lagi atau unggah file.");
  }
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") {
    return importError("REMOTE_NOT_FOUND", "Alamat situs tidak ditemukan. Periksa URL-nya.");
  }
  return importError("REMOTE_FAILED", "Gambar tidak dapat diunduh dari URL tersebut.");
}

export async function fetchRemoteImage(rawUrl: string, options: RemoteImageOptions = {}): Promise<RemoteImage> {
  const maxBytes = options.maxBytes ?? MAX_UPLOAD_BYTES;
  const isBlocked = options.isBlocked ?? isBlockedAddress;
  const lookup = safeLookup(isBlocked);
  const signal = AbortSignal.timeout(options.timeoutMs ?? TIMEOUT_MS);

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw importError("INVALID_URL", "URL tidak valid.");
  }

  for (let redirects = 0; ; redirects += 1) {
    checkUrl(url, isBlocked, options.allowAnyPort === true);
    let response: Response;
    try {
      response = await requestOnce(url, lookup, signal, maxBytes);
    } catch (error) {
      throw mapNetworkError(error);
    }

    if (response.status >= 300 && response.status < 400 && response.location) {
      if (redirects >= MAX_REDIRECTS) throw importError("TOO_MANY_REDIRECTS", "URL terlalu banyak dialihkan.");
      try {
        url = new URL(response.location, url);
      } catch {
        throw importError("REMOTE_FAILED", "Gambar tidak dapat diunduh dari URL tersebut.");
      }
      continue;
    }
    if (response.status !== 200 || !response.body) {
      throw importError("REMOTE_FAILED", `Gambar tidak dapat diunduh (HTTP ${response.status}).`);
    }
    if (response.contentType && !response.contentType.toLowerCase().startsWith("image/")) {
      throw importError(
        "NOT_AN_IMAGE",
        "URL harus mengarah langsung ke file gambar, bukan ke halaman web.",
      );
    }
    if (response.body.byteLength === 0) throw importError("EMPTY_FILE", "Gambar dari URL kosong.");
    return { data: response.body, name: fileNameFrom(url) };
  }
}
