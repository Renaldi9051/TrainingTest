// Keputusan reveal untuk satu elemen saat komponen pertama kali terpasang di browser.
// Server selalu merender keadaan final (terlihat), jadi tanpa JS atau saat reduced motion konten
// tetap utuh. Hanya elemen yang seluruhnya di bawah layar awal yang disembunyikan lalu dianimasikan
// masuk; konten layar pertama tidak pernah tertahan (DESIGN.md 8.3).
export type RevealStart = "static" | "hidden";

export function revealStart({
  top,
  viewportHeight,
  reducedMotion,
  supportsObserver,
}: {
  // getBoundingClientRect().top saat mount.
  top: number;
  viewportHeight: number;
  reducedMotion: boolean;
  supportsObserver: boolean;
}): RevealStart {
  if (reducedMotion || !supportsObserver) return "static";
  return top >= viewportHeight ? "hidden" : "static";
}
