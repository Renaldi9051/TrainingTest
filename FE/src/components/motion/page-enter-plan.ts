import { PAGE_ENTER_MS, PAGE_ENTER_SHIFT_PX, PAGE_ENTER_STEP_MS, PAGE_ENTER_TOTAL_MS } from "./tokens";

// Pergantian halaman (DESIGN.md 8.2 & 8.3): header halaman (elemen bertanda data-page-enter) stagger
// masuk hanya setelah navigasi klien ke pathname baru yang dipicu klik link (mouse atau Enter).
// Fungsi murni, dites di Vitest.

// Batas waktu antara klik link dan commit halaman baru (navigasi lambat tetap dihitung).
export const LINK_INTENT_MS = 10_000;

export type EnterContext = {
  // Render pertama layout publik (muat penuh, reload, atau masuk dari admin): tidak beranimasi.
  firstRender: boolean;
  pathnameChanged: boolean;
  // ms sejak klik link internal terakhir yang belum terpakai (null = tidak ada). Back/Forward
  // tidak diawali klik, jadi tidak beranimasi.
  sinceLinkClick: number | null;
  reducedMotion: boolean;
};

export function shouldAnimateEnter({ firstRender, pathnameChanged, sinceLinkClick, reducedMotion }: EnterContext): boolean {
  if (firstRender || !pathnameChanged || reducedMotion || sinceLinkClick === null) return false;
  return sinceLinkClick <= LINK_INTENT_MS;
}

// Klik yang dihitung sebagai navigasi klien oleh link: tombol utama tanpa modifier, link internal
// yang dibuka di tab yang sama.
export function isClientLinkClick(
  event: { button: number; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean; defaultPrevented: boolean },
  link: { href: string; target: string; hasDownload: boolean },
  origin: string,
): boolean {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
  if (link.hasDownload || (link.target !== "" && link.target !== "_self")) return false;
  try {
    return new URL(link.href, origin).origin === origin;
  } catch {
    return false;
  }
}

// Jeda antar elemen header: 60 ms, dipadatkan supaya elemen terakhir selesai <= 500 ms.
export function pageEnterStepMs(count: number): number {
  if (count <= 1) return 0;
  return Math.min(PAGE_ENTER_STEP_MS, Math.floor((PAGE_ENTER_TOTAL_MS - PAGE_ENTER_MS) / (count - 1)));
}

// Keadaan awal per elemen: judul (h1) wipe dari bawah + naik, lainnya fade + naik. Hanya opacity,
// transform, clip-path.
export function pageEnterFrom(tagName: string): { opacity?: number; transform: string; clipPath?: string } {
  if (tagName.toLowerCase() === "h1") return { transform: `translateY(${PAGE_ENTER_SHIFT_PX}px)`, clipPath: "inset(0% 0% 100% 0%)" };
  return { opacity: 0, transform: `translateY(${PAGE_ENTER_SHIFT_PX}px)` };
}
