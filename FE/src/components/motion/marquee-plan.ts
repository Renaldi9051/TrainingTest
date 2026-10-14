// VelocityMarquee (DESIGN.md 8.2): kecepatan & arah ikut kecepatan scroll, lalu kembali pelan ke laju
// dasar saat scroll berhenti. Laju dasar 0 (section teks besar) = berhenti; logo klien berjalan sendiri
// (MARQUEE_AUTO_SPEED, keputusan pemilik 14 Okt 2026). Fungsi murni, dites di Vitest.

// px geser marquee per px scroll, batas kecepatan (px per frame), dan peluruhan per frame.
export const MARQUEE_GAIN = 0.35;
export const MARQUEE_MAX_SPEED = 14;
export const MARQUEE_DECAY = 0.9;
export const MARQUEE_MIN_SPEED = 0.05;
// Laju dasar logo klien saat tidak di-scroll: px per frame 60 Hz (~36 px/detik), ke kiri.
export const MARQUEE_AUTO_SPEED = 0.6;
// Durasi satu frame acuan (60 Hz): gerak dikali dt / FRAME_MS supaya laju sama di layar 120 Hz.
export const FRAME_MS = 1000 / 60;

// Kecepatan frame berikutnya: scroll di frame ini mendorong (arah = arah scroll, ke bawah = ke
// kiri), tanpa scroll kecepatan meluruh ke laju dasar (0 = berhenti).
export function nextSpeed(speed: number, scrollDelta: number, base = 0): number {
  if (scrollDelta === 0) {
    const next = base + (speed - base) * MARQUEE_DECAY;
    return Math.abs(next - base) < MARQUEE_MIN_SPEED ? base : next;
  }
  const push = Math.max(-MARQUEE_MAX_SPEED, Math.min(MARQUEE_MAX_SPEED, scrollDelta * MARQUEE_GAIN));
  const next = speed * 0.6 + push * 0.4;
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
