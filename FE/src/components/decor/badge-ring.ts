// Huruf teks melingkar RotatingBadge: tiap huruf diputar sama rata mengelilingi lingkaran, dimulai
// dari atas (0 derajat), searah jarum jam. Fungsi murni, dites di Vitest.

const SEPARATOR = " • ";

// Teks badge dari CMS (mis. "Konsultasi gratis • Hubungi kami") jadi satu putaran penuh: uppercase,
// spasi dirapikan, dan diakhiri pemisah supaya ujung bertemu awal dengan jarak.
export function badgeRingText(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim().toUpperCase();
  if (!clean) return "";
  return clean.endsWith("•") ? `${clean} ` : `${clean}${SEPARATOR}`;
}

export type RingChar = { char: string; angle: number };

export function badgeRingChars(text: string): RingChar[] {
  const chars = Array.from(badgeRingText(text));
  const step = 360 / Math.max(chars.length, 1);
  return chars.map((char, index) => ({ char, angle: Number((index * step).toFixed(2)) }));
}
