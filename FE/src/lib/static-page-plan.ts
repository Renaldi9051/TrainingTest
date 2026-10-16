import type { PublicPageBlock } from "@/lib/api/types";

// Daftar isi halaman statis (mockup halaman-statis.html): dari judul blok yang berisi, bernomor.
// Isi blok tidak diubah; anchor berdasarkan urutan blok. Fungsi murni, dites di Vitest.

export type TocEntry = { id: string; label: string };

export function blockAnchor(index: number): string {
  return `bagian-${index + 1}`;
}

function blockHeading(block: PublicPageBlock): string {
  if (block.type === "IMAGE" || block.type === "VISION_MISSION") return "";
  return block.heading.trim();
}

const ENTITIES: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&nbsp;": " " };

function plainHeading(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (entity) => ENTITIES[entity] ?? entity)
    .replace(/\s+/g, " ")
    .trim();
}

// Subjudul h2/h3 di rich text (HTML allowlist dari BE, tag polos tanpa atribut) diberi id supaya bisa
// dituju daftar isi. Teks tidak diubah.
export function anchorHeadings(html: string, prefix: string): { html: string; headings: TocEntry[] } {
  const headings: TocEntry[] = [];
  const anchored = html.replace(/<(h[23])>([\s\S]*?)<\/\1>/g, (match, tag: string, inner: string) => {
    const label = plainHeading(inner);
    if (!label) return match;
    const id = `${prefix}-${headings.length + 1}`;
    headings.push({ id, label });
    return `<${tag} id="${id}">${inner}</${tag}>`;
  });
  return { html: anchored, headings };
}

// Daftar isi: judul blok, lalu subjudul di dalam teks. Hanya kalau ada minimal 2 entri.
export function tocEntries(blocks: PublicPageBlock[]): TocEntry[] {
  const entries = blocks.flatMap((block, index) => {
    const label = blockHeading(block);
    const own = label ? [{ id: blockAnchor(index), label }] : [];
    const inner = block.type === "RICH_TEXT" ? anchorHeadings(block.bodyHtml, blockAnchor(index)).headings : [];
    return [...own, ...inner];
  });
  return entries.length >= 2 ? entries : [];
}

// "01 OKT 2026" untuk label DIPERBARUI (WIB).
export function updatedLabel(value: string): string {
  const parts = new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Jakarta" }).formatToParts(new Date(value));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("day")} ${get("month").replace(".", "").toUpperCase()} ${get("year")}`;
}
