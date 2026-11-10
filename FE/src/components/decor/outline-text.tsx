import { cn } from "@/lib/utils";

// Teks outline raksasa di belakang konten (DESIGN.md 6.1): token mega, stroke 1 px, isi transparan.
// Isi dari CMS (judul section/kategori); kosong = tidak dirender. Posisi lewat className (di dalam
// tepi induk, bukan menembus tepi). parallax: bergeser pelan mengikuti scroll (ParallaxEffects, maks
// 80 px), dihitung dari posisi elemen induk.
//
// Selalu utuh (pemilik, 10 Nov 2026): ukuran huruf = token mega, tapi mengecil untuk teks panjang
// supaya muat di lebar konten (maks 1280 px dikurangi padding). Lebar Poppins 600 diperkirakan
// 0,7em per karakter (huruf kapital lebar); parallax diberi ruang tambahan untuk geseran ±80 px.
const CHAR_WIDTH_EM = 0.7;

function fitFontSize(length: number, parallax: boolean): string {
  // Ruang geser parallax ikut lebar layar (4rem di HP, 14rem mulai ~800 px) supaya teks di HP tidak
  // mengecil berlebihan; di tengah layar geseran 0, jadi teks tetap utuh saat dibaca.
  const gutter = parallax ? "clamp(4rem, 100vw - 576px, 14rem)" : "4rem";
  return `min(var(--type-mega), calc((min(100vw, 1280px) - ${gutter}) / ${(length * CHAR_WIDTH_EM).toFixed(2)}))`;
}

export function OutlineText({
  children,
  decor = true,
  tone = "light",
  parallax = false,
  className,
}: {
  children: string | null | undefined;
  decor?: boolean;
  tone?: "light" | "inverse";
  parallax?: boolean;
  className?: string;
}) {
  const text = children?.trim();
  if (!decor || !text) return null;
  return (
    <div
      aria-hidden
      data-parallax-x={parallax ? "" : undefined}
      style={{ fontSize: fitFontSize(text.length, parallax) }}
      className={cn(
        "pointer-events-none absolute z-0 text-mega whitespace-nowrap text-transparent select-none",
        tone === "inverse" ? "[-webkit-text-stroke:1px_var(--outline-stroke-dark,var(--inverse-line))]" : "[-webkit-text-stroke:1px_var(--outline-stroke,var(--border-strong))]",
        className,
      )}
    >
      {text}
    </div>
  );
}
