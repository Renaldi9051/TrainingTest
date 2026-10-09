import { z } from "zod";

// Rich text disimpan sebagai JSON Tiptap. Allowlist di sini dipakai untuk validasi saat simpan
// DAN untuk render HTML, jadi tidak ada node/mark/atribut di luar daftar ini yang bisa tampil.
//
// Node : doc, paragraph, heading (level 2-3), bulletList, orderedList, listItem, blockquote,
//        text, hardBreak
// Mark : bold, italic, link (href http/https/mailto/tel)
//
// Node atau mark yang tidak dikenal ditolak. Atribut yang tidak dikenal dibuang (Tiptap kadang
// menambah atribut default seperti `class: null`), jadi yang tersimpan selalu bentuk bersih.

export type RichTextMark =
  | { type: "bold" }
  | { type: "italic" }
  | { type: "link"; attrs: { href: string } };

export type RichTextInline =
  | { type: "text"; text: string; marks?: RichTextMark[] }
  | { type: "hardBreak" };

export type RichTextBlock =
  | { type: "paragraph"; content?: RichTextInline[] }
  | { type: "heading"; attrs: { level: 2 | 3 }; content?: RichTextInline[] }
  | { type: "bulletList"; content: RichTextListItem[] }
  | { type: "orderedList"; attrs?: { start?: number }; content: RichTextListItem[] }
  | { type: "blockquote"; content: RichTextBlock[] };

export type RichTextListItem = { type: "listItem"; content: RichTextBlock[] };

export type RichTextDoc = { type: "doc"; content: RichTextBlock[] };

const ALLOWED_LINK_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);
const MAX_DOC_BYTES = 200_000;
const MAX_TEXT_LENGTH = 20_000;

export function isAllowedHref(href: string): boolean {
  const value = href.trim();
  // Hanya URL absolut; URL relatif/protocol-relative ditolak supaya protokol selalu jelas.
  if (!/^[a-z][a-z0-9+.-]*:/i.test(value)) return false;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (!ALLOWED_LINK_PROTOCOLS.has(url.protocol)) return false;
  if ((url.protocol === "http:" || url.protocol === "https:") && !url.hostname) return false;
  return true;
}

const LINK_ERROR = "Link hanya boleh http, https, mailto, atau tel.";

const markSchema: z.ZodType<RichTextMark> = z.discriminatedUnion("type", [
  z.object({ type: z.literal("bold") }),
  z.object({ type: z.literal("italic") }),
  z.object({
    type: z.literal("link"),
    attrs: z.object({
      href: z.string().trim().max(2000).refine(isAllowedHref, { error: LINK_ERROR }),
    }),
  }),
]);

const inlineSchema: z.ZodType<RichTextInline> = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("text"),
    text: z.string().min(1).max(MAX_TEXT_LENGTH),
    marks: z.array(markSchema).max(5).optional(),
  }),
  z.object({ type: z.literal("hardBreak") }),
]);

const inlineContent = z.array(inlineSchema).max(2000).optional();

const listItemSchema: z.ZodType<RichTextListItem> = z.lazy(() =>
  z.object({ type: z.literal("listItem"), content: z.array(blockSchema).min(1).max(50) }),
);

const blockSchema: z.ZodType<RichTextBlock> = z.lazy(() =>
  z.discriminatedUnion("type", [
    z.object({ type: z.literal("paragraph"), content: inlineContent }),
    z.object({
      type: z.literal("heading"),
      attrs: z.object({
        level: z.union([z.literal(2), z.literal(3)], { error: "Judul hanya boleh level 2 atau 3." }),
      }),
      content: inlineContent,
    }),
    z.object({ type: z.literal("bulletList"), content: z.array(listItemSchema).min(1).max(200) }),
    z.object({
      type: z.literal("orderedList"),
      attrs: z.object({ start: z.number().int().min(0).max(10_000).optional() }).optional(),
      content: z.array(listItemSchema).min(1).max(200),
    }),
    z.object({ type: z.literal("blockquote"), content: z.array(blockSchema).min(1).max(50) }),
  ]),
);

export const richTextSchema: z.ZodType<RichTextDoc> = z
  .object({ type: z.literal("doc"), content: z.array(blockSchema).max(1000) })
  .refine((doc) => JSON.stringify(doc).length <= MAX_DOC_BYTES, {
    error: "Isi teks terlalu panjang.",
  });

// Field rich text opsional: null atau dokumen kosong disimpan sebagai null.
export const optionalRichTextSchema = richTextSchema
  .nullable()
  .transform((doc) => (doc && !isRichTextEmpty(doc) ? doc : null))
  .optional();

export function isRichTextEmpty(doc: RichTextDoc): boolean {
  return richTextToPlain(doc).trim() === "";
}

// ===== Render =====

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderInline(node: RichTextInline): string {
  if (node.type === "hardBreak") return "<br>";
  let html = escapeHtml(node.text);
  // Urutan tetap supaya tag selalu bersarang benar: link paling luar.
  const marks = node.marks ?? [];
  if (marks.some((mark) => mark.type === "italic")) html = `<em>${html}</em>`;
  if (marks.some((mark) => mark.type === "bold")) html = `<strong>${html}</strong>`;
  const link = marks.find((mark) => mark.type === "link");
  if (link && isAllowedHref(link.attrs.href)) {
    const href = escapeHtml(link.attrs.href.trim());
    const external = /^https?:/i.test(link.attrs.href.trim());
    html = external
      ? `<a href="${href}" target="_blank" rel="noopener noreferrer nofollow">${html}</a>`
      : `<a href="${href}">${html}</a>`;
  }
  return html;
}

function renderInlines(content: RichTextInline[] | undefined): string {
  return (content ?? []).map(renderInline).join("");
}

function renderBlock(node: RichTextBlock): string {
  switch (node.type) {
    case "paragraph":
      return `<p>${renderInlines(node.content)}</p>`;
    case "heading":
      return `<h${node.attrs.level}>${renderInlines(node.content)}</h${node.attrs.level}>`;
    case "bulletList":
      return `<ul>${node.content.map(renderListItem).join("")}</ul>`;
    case "orderedList": {
      const start = node.attrs?.start;
      const startAttr = start !== undefined && start !== 1 ? ` start="${start}"` : "";
      return `<ol${startAttr}>${node.content.map(renderListItem).join("")}</ol>`;
    }
    case "blockquote":
      return `<blockquote>${node.content.map(renderBlock).join("")}</blockquote>`;
  }
}

function renderListItem(node: RichTextListItem): string {
  return `<li>${node.content.map(renderBlock).join("")}</li>`;
}

// Input divalidasi ulang sebelum dirender: data lama/rusak di DB tidak pernah tampil mentah.
export function renderRichText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const parsed = richTextSchema.safeParse(value);
  if (!parsed.success || isRichTextEmpty(parsed.data)) return null;
  return parsed.data.content.map(renderBlock).join("");
}

// ===== Teks polos (deskripsi SEO, pencarian) =====

function plainInline(node: RichTextInline): string {
  return node.type === "text" ? node.text : " ";
}

function plainBlock(node: RichTextBlock | RichTextListItem): string {
  if (node.type === "paragraph" || node.type === "heading") {
    return (node.content ?? []).map(plainInline).join("");
  }
  return node.content.map(plainBlock).join(" ");
}

export function richTextToPlain(doc: RichTextDoc): string {
  return doc.content.map(plainBlock).join(" ").replace(/\s+/g, " ").trim();
}
