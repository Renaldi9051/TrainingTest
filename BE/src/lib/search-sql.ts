import { Prisma } from "@/generated/prisma/client";
import { likeContainsPattern, normalizeSearchText, toPrefixTsQuery } from "@/lib/search";

// Potongan SQL pencarian yang dipakai search global admin dan search publik (Ctrl/Cmd+K).
// Nama kolom selalu dari kode (Prisma.raw), nilai dari pengguna selalu sebagai parameter.

// Kolom "mengandung" kata kunci tanpa aksen/huruf besar; wildcard pengguna sudah di-escape.
export function anyColumnLike(columns: string[], pattern: string): Prisma.Sql {
  return Prisma.join(
    columns.map(
      (column) =>
        Prisma.sql`public.immutable_unaccent(lower(coalesce(${Prisma.raw(column)}, ''))) LIKE ${pattern} ESCAPE '\\'`,
    ),
    " OR ",
  );
}

// Kolom diawali kata kunci (ekspresi boolean), tanpa aksen/huruf besar.
export function startsWithText(column: string, query: string): Prisma.Sql {
  const prefix = likeContainsPattern(query).slice(1);
  return Prisma.sql`(public.immutable_unaccent(lower(${Prisma.raw(column)})) LIKE ${prefix} ESCAPE '\\')`;
}

// Urutan: judul yang diawali kata kunci tampil lebih dulu.
export function startsFirst(column: string, query: string): Prisma.Sql {
  return Prisma.sql`${startsWithText(column, query)} DESC`;
}

// Pelatihan (alias t): full-text searchVector (judul, kategori, ringkasan, judul modul) + trigram judul
// untuk salah ketik + slug. Ambang trigram dipasang per transaksi oleh pemanggil (set_config).
export function trainingTextSearch(query: string): { match: Prisma.Sql; rank: Prisma.Sql } {
  const tsQuery = toPrefixTsQuery(query);
  const normalized = normalizeSearchText(query);
  const matches: Prisma.Sql[] = [anyColumnLike(['t."slug"'], likeContainsPattern(query))];
  if (tsQuery) matches.push(Prisma.sql`t."searchVector" @@ to_tsquery('public.simple_unaccent', ${tsQuery})`);
  if (normalized) matches.push(Prisma.sql`${normalized} <% t."searchTitle"`);
  const rank = tsQuery
    ? Prisma.sql`ts_rank(t."searchVector", to_tsquery('public.simple_unaccent', ${tsQuery})) * 2 + word_similarity(${normalized}, t."searchTitle")`
    : Prisma.sql`word_similarity(${normalized}, t."searchTitle")`;
  return { match: Prisma.sql`(${Prisma.join(matches, " OR ")})`, rank };
}
