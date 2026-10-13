// VelocityMarquee (DESIGN.md 8.2): kecepatan & arah ikut kecepatan scroll, melambat lalu berhenti saat
// scroll berhenti (keputusan 4.1e: tidak berjalan sendiri, DESIGN.md 8.3). Fungsi murni, dites di Vitest.

// px geser marquee per px scroll, batas kecepatan (px per frame), dan peluruhan per frame.
export const MARQUEE_GAIN = 0.35;
export const MARQUEE_MAX_SPEED = 14;
export const MARQUEE_DECAY = 0.9;
export const MARQUEE_MIN_SPEED = 0.05;

// Kecepatan frame berikutnya: scroll di frame ini mendorong (arah = arah scroll, ke bawah = ke
// kiri), tanpa scroll kecepatan meluruh sampai berhenti.
export function nextSpeed(speed: number, scrollDelta: number): number {
  const push = Math.max(-MARQUEE_MAX_SPEED, Math.min(MARQUEE_MAX_SPEED, scrollDelta * MARQUEE_GAIN));
  const next = scrollDelta === 0 ? speed * MARQUEE_DECAY : speed * 0.6 + push * 0.4;
  return Math.abs(next) < MARQUEE_MIN_SPEED ? 0 : next;
}

// Posisi dibungkus ke (-half, 0]: dua salinan isi, jadi geser satu salinan penuh tampak sama.
export function wrapOffset(x: number, half: number): number {
  if (half <= 0) return 0;
  let value = x % half;
  if (value > 0) value -= half;
  return value === -half ? 0 : value || 0;
}

// Posisi supaya elemen terfokus (offset & lebar di salinan pertama) terlihat utuh di kontainer:
// diusahakan di tengah, dibatasi ke [-(half), 0] supaya yang terlihat tetap salinan pertama.
export function focusOffset(offset: number, width: number, containerWidth: number, half: number): number {
  const centered = containerWidth / 2 - (offset + width / 2);
  return Math.max(-half, Math.min(0, centered));
}
