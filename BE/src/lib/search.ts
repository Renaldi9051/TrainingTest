// Pencarian katalog: Postgres full-text (config simple_unaccent) untuk kata utuh/awalan,
// ditambah pg_trgm (word similarity) di judul untuk salah ketik. Lihat services/training-search.ts.

const MAX_TOKENS = 8;
const MAX_TOKEN_LENGTH = 40;

// "Akuntánsi  & Pajak!" -> "akuntansi pajak" (sama dengan kolom searchTitle: lower + unaccent).
export function normalizeSearchText(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function searchTokens(input: string): string[] {
  return normalizeSearchText(input)
    .split(" ")
    .filter(Boolean)
    .map((token) => token.slice(0, MAX_TOKEN_LENGTH))
    .slice(0, MAX_TOKENS);
}

// Setiap kata jadi awalan (`kata:*`), semua kata wajib ada (&). Token hanya [a-z0-9], jadi aman
// dipakai sebagai input to_tsquery (tetap dikirim sebagai parameter, bukan disambung ke SQL).
export function toPrefixTsQuery(input: string): string | null {
  const tokens = searchTokens(input);
  return tokens.length > 0 ? tokens.map((token) => `${token}:*`).join(" & ") : null;
}

// Ambang word_similarity untuk pencocokan typo. Default pg_trgm 0.6 terlalu ketat untuk salah
// ketik 1-2 huruf pada kata pendek-menengah.
export const TYPO_SIMILARITY_THRESHOLD = 0.45;

// ===== Pencarian "mengandung teks" (search global admin) =====

// Huruf kecil tanpa aksen, spasi dirapatkan; tanda baca tetap (email, nomor, URL tetap bisa dicari).
// Sama dengan public.immutable_unaccent(lower(...)) di sisi SQL.
export function foldText(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// Regex POSIX Postgres "kata/frasa utuh" untuk kolom yang sudah di-fold (mis. Training.searchTitle):
// tidak diapit huruf/angka lain, jadi "drone" tidak cocok dengan "drones" dan "C++" tetap bisa dipakai.
export function wholeWordRegex(keyword: string): string {
  const escaped = foldText(keyword).replace(/[\\^$.|?*+()[\]{}]/g, (char) => `\\${char}`);
  return `(^|[^[:alnum:]])${escaped}($|[^[:alnum:]])`;
}

// Pola LIKE "mengandung" dengan wildcard pengguna (% _ \) di-escape; dipakai dengan ESCAPE '\'.
export function likeContainsPattern(query: string): string {
  return `%${foldText(query).replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

// Kunci JSON yang nilainya teknis (tipe node rich text, id, ikon, tautan, enum), bukan teks konten.
const NON_TEXT_KEYS = new Set([
  "type",
  "attrs",
  "marks",
  "id",
  "icon",
  "href",
  "url",
  "mode",
  "style",
  "variant",
  "source",
  "platform",
  "mime",
]);

// Semua nilai string konten di dalam JSON (section beranda, blok halaman, pengaturan). Kunci teknis dan
// kunci berakhiran "Id"/"Ids" (referensi media/entitas) dilewati.
export function collectTextValues(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") {
    if (value.trim()) out.push(value);
  } else if (Array.isArray(value)) {
    for (const item of value) collectTextValues(item, out);
  } else if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      if (NON_TEXT_KEYS.has(key) || /Ids?$/.test(key)) continue;
      collectTextValues(item, out);
    }
  }
  return out;
}

// Potongan teks di sekitar kecocokan pertama (maks ~`width` karakter), atau null kalau tidak cocok.
export function matchSnippet(text: string, query: string, width = 80): string | null {
  const folded = foldText(text);
  const needle = foldText(query);
  // foldText bisa memendekkan teks (spasi dirapatkan), jadi potong dari teks yang sudah dirapatkan.
  const compact = text.normalize("NFKC").replace(/\s+/g, " ").trim();
  const index = folded.indexOf(needle);
  if (!needle || index < 0) return null;
  if (compact.length <= width) return compact;
  const start = Math.max(0, Math.min(index - Math.floor((width - needle.length) / 2), compact.length - width));
  const slice = compact.slice(start, start + width).trim();
  return `${start > 0 ? "…" : ""}${slice}${start + width < compact.length ? "…" : ""}`;
}
