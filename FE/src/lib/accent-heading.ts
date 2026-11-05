// Judul dengan satu kata aksen (DESIGN.md 3: maks 1 per judul) dari teks CMS: kata yang diapit
// bintang, mis. "Pelatihan untuk setiap *bidang* kerja". Hanya pasangan bintang pertama yang dipakai;
// bintang lain dibuang supaya tidak tampil mentah.
export type AccentHeading = { before: string; accent: string; after: string };

export function parseAccentHeading(value: string): AccentHeading {
  const match = /\*([^*]+)\*/.exec(value);
  if (!match || !match[1].trim()) return { before: stripStars(value), accent: "", after: "" };
  return {
    before: stripStars(value.slice(0, match.index)),
    accent: match[1].trim(),
    after: stripStars(value.slice(match.index + match[0].length)),
  };
}

function stripStars(text: string): string {
  return text.replaceAll("*", "");
}
