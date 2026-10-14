// Pencocokan teks di klien (search global admin: nama modul, label field pengaturan).
// Sama dengan foldText di BE (src/lib/search.ts): huruf kecil, tanpa aksen, spasi dirapatkan.
export function foldText(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// Semua kata kunci ada di salah satu teks (urutan bebas): "nomor wa" cocok dengan sinonim
// "nomor WA" maupun label "WhatsApp" + sinonim "nomor".
export function matchesAllWords(query: string, texts: readonly string[]): boolean {
  const words = foldText(query).split(" ").filter(Boolean);
  if (words.length === 0) return false;
  const haystack = texts.map(foldText).join(" ");
  return words.every((word) => haystack.includes(word));
}
