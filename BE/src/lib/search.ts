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
