import type { PublicPageBlock } from "@/lib/api/types";

// Urutan blok profil dipertahankan; hanya dua blok daftar yang berurutan digabung jadi satu baris
// berdampingan (mockup: bidang unggulan + target peserta). Fungsi murni, dites di Vitest.
type ListBlock = Extract<PublicPageBlock, { type: "LIST" }>;
export type ProfileItem = { kind: "block"; block: PublicPageBlock } | { kind: "lists"; lists: ListBlock[] };

export function groupProfileBlocks(blocks: PublicPageBlock[]): ProfileItem[] {
  const items: ProfileItem[] = [];
  for (const block of blocks) {
    const last = items.at(-1);
    if (block.type === "LIST" && last?.kind === "block" && last.block.type === "LIST") {
      items[items.length - 1] = { kind: "lists", lists: [last.block, block] };
    } else {
      items.push({ kind: "block", block });
    }
  }
  return items;
}
