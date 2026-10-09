import type { RichTextDoc } from "@/lib/api/types";

// Cerminan aturan link di BE/src/lib/rich-text.ts (BE tetap yang memutuskan saat simpan).
const ALLOWED_LINK_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);

export function isAllowedHref(href: string): boolean {
  const value = href.trim();
  if (!/^[a-z][a-z0-9+.-]*:/i.test(value)) return false;
  try {
    const url = new URL(value);
    if (!ALLOWED_LINK_PROTOCOLS.has(url.protocol)) return false;
    return !((url.protocol === "http:" || url.protocol === "https:") && !url.hostname);
  } catch {
    return false;
  }
}

export const EMPTY_DOC: RichTextDoc = { type: "doc", content: [{ type: "paragraph" }] };

function hasText(node: unknown): boolean {
  if (typeof node !== "object" || node === null) return false;
  const record = node as { type?: unknown; text?: unknown; content?: unknown };
  if (record.type === "text" && typeof record.text === "string") return record.text.trim() !== "";
  return Array.isArray(record.content) && record.content.some(hasText);
}

export function isRichTextEmpty(doc: RichTextDoc | null | undefined): boolean {
  return !doc || !hasText(doc);
}
