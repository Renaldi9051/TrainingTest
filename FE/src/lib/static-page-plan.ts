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

// Daftar isi hanya kalau ada minimal 2 judul (satu judul tidak perlu navigasi).
export function tocEntries(blocks: PublicPageBlock[]): TocEntry[] {
  const entries = blocks.flatMap((block, index) => {
    const label = blockHeading(block);
    return label ? [{ id: blockAnchor(index), label }] : [];
  });
  return entries.length >= 2 ? entries : [];
}

// "01 OKT 2026" untuk label DIPERBARUI (WIB).
export function updatedLabel(value: string): string {
  const parts = new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Jakarta" }).formatToParts(new Date(value));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("day")} ${get("month").replace(".", "").toUpperCase()} ${get("year")}`;
}
