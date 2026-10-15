import { foldText } from "@/lib/text-match";

// Indeks A-Z (overlay kategori, PRD 5.2): item dikelompokkan per huruf awal, disaring dengan teks
// ketikan (tanpa beda huruf besar/kecil & aksen). Fungsi murni, dites di Vitest.

export type IndexItem = { label: string; href: string; count?: number };
export type IndexGroup = { letter: string; items: IndexItem[] };

// Huruf awal tanpa aksen; selain A-Z (angka, simbol) masuk "#", ditaruh paling akhir.
export function indexLetter(label: string): string {
  const first = foldText(label).charAt(0).toUpperCase();
  return /^[A-Z]$/.test(first) ? first : "#";
}

export function groupIndexItems(items: readonly IndexItem[], query = ""): IndexGroup[] {
  const words = foldText(query).split(" ").filter(Boolean);
  const matches = (item: IndexItem) => {
    const text = foldText(item.label);
    return words.every((word) => text.includes(word));
  };
  const groups = new Map<string, IndexItem[]>();
  for (const item of items) {
    if (!matches(item)) continue;
    const letter = indexLetter(item.label);
    const list = groups.get(letter) ?? [];
    list.push(item);
    groups.set(letter, list);
  }
  const compare = (a: string, b: string) => a.localeCompare(b, "id", { sensitivity: "base" });
  return [...groups.entries()]
    .sort(([a], [b]) => (a === "#" ? 1 : b === "#" ? -1 : compare(a, b)))
    .map(([letter, list]) => ({ letter, items: [...list].sort((a, b) => compare(a.label, b.label)) }));
}
