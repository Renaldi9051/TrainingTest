// Pembuat dokumen Tiptap kecil untuk data contoh (seed & skrip sinkronisasi). Hanya node allowlist
// (BE/src/lib/rich-text.ts): paragraf, heading level 3, daftar berbutir.
import type { RichTextBlock, RichTextDoc } from "../../src/lib/rich-text";

const text = (value: string) => ({ type: "text" as const, text: value });

export const p = (value: string): RichTextBlock => ({ type: "paragraph", content: [text(value)] });

export const h3 = (value: string): RichTextBlock => ({ type: "heading", attrs: { level: 3 }, content: [text(value)] });

export const ul = (...items: string[]): RichTextBlock => ({
  type: "bulletList",
  content: items.map((item) => ({ type: "listItem", content: [p(item)] })),
});

export const doc = (...content: RichTextBlock[]): RichTextDoc => ({ type: "doc", content });

// Dokumen berisi paragraf saja.
export const paragraphs = (...texts: string[]): RichTextDoc => doc(...texts.map(p));
