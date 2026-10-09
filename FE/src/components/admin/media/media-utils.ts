import type { Media } from "@/lib/api/types";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const ACCEPTED_FILES = ".jpg,.jpeg,.png,.webp,.svg,.pdf,image/jpeg,image/png,image/webp,image/svg+xml,application/pdf";

export const mediaKeys = {
  all: ["admin", "media"] as const,
  list: (params: { page: number; q: string; folder: string }) =>
    ["admin", "media", "list", params] as const,
  detail: (id: string) => ["admin", "media", "detail", id] as const,
  folders: ["admin", "media", "folders"] as const,
};

export function isImage(media: Pick<Media, "mime">): boolean {
  return media.mime.startsWith("image/");
}

// Gambar wajib punya alt text sebelum tampil di publik (PRD 6.3).
export function isMissingAlt(media: Pick<Media, "mime" | "alt">): boolean {
  return isImage(media) && !media.alt;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(value)} ${units[unit]}`;
}

export function mediaTypeLabel(mime: string): string {
  if (mime === "image/webp") return "WebP";
  if (mime === "image/svg+xml") return "SVG";
  if (mime === "application/pdf") return "PDF";
  return mime;
}

export function mediaName(media: Pick<Media, "originalName" | "url">): string {
  return media.originalName ?? media.url.split("/").pop() ?? "Tanpa nama";
}
