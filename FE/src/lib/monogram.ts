// Favicon cadangan (app/icon): monogram dari nama situs di CMS, dipakai selama favicon CMS kosong.
export const FALLBACK_ICON_PATH = "/icon";

// Huruf/angka pertama nama situs, huruf besar. Kosong kalau nama tidak punya huruf/angka.
export function monogramInitial(name: string): string {
  const match = /[\p{L}\p{N}]/u.exec(name);
  return match ? match[0].toLocaleUpperCase("id-ID") : "";
}
