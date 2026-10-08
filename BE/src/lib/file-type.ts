import { fileTypeFromBuffer } from "file-type";

// Cek cepat apakah buffer tampak seperti dokumen SVG (teks, tanpa byte NUL, ada elemen <svg>).
export function looksLikeSvg(data: Uint8Array): boolean {
  const head = data.subarray(0, 4096);
  if (head.includes(0)) return false;
  // TextDecoder sudah membuang BOM UTF-8 di awal.
  const text = new TextDecoder("utf-8", { fatal: false }).decode(head);
  return /^\s*(<\?xml[\s\S]*?\?>\s*)?(<!--[\s\S]*?-->\s*)*(<!DOCTYPE[^>]*>\s*)?<svg[\s>]/i.test(text);
}

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export type DetectedFile =
  | { kind: "raster"; mime: "image/jpeg" | "image/png" | "image/webp" }
  | { kind: "svg"; mime: "image/svg+xml" }
  | { kind: "pdf"; mime: "application/pdf" };

const RASTER_MIMES = new Set(["image/jpeg", "image/png", "image/webp"]);

// MIME ditentukan dari isi file (magic bytes), bukan dari ekstensi atau Content-Type kiriman browser.
// SVG berbasis teks sehingga tidak punya magic bytes; dideteksi dari isinya lalu disanitasi terpisah.
export async function detectFileType(data: Uint8Array): Promise<DetectedFile | null> {
  const detected = await fileTypeFromBuffer(data);
  if (detected) {
    if (RASTER_MIMES.has(detected.mime)) {
      return { kind: "raster", mime: detected.mime as "image/jpeg" | "image/png" | "image/webp" };
    }
    if (detected.mime === "application/pdf") return { kind: "pdf", mime: "application/pdf" };
    // SVG dengan deklarasi <?xml ?> terdeteksi sebagai XML generik; isinya tetap dicek di bawah.
    if (detected.mime !== "application/xml" && detected.mime !== "image/svg+xml") return null;
  }
  if (looksLikeSvg(data)) return { kind: "svg", mime: "image/svg+xml" };
  return null;
}
