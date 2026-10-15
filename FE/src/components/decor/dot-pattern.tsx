import { cn } from "@/lib/utils";

// Titik 1 px tiap 24 px warna --border-strong, memudar ke tepi (mask). Mask hanya mengatur
// transparansi; "black" di sini bukan warna yang tampil.
const DOT_STYLE = {
  backgroundImage: "radial-gradient(var(--border-strong) 1px, transparent 1px)",
  backgroundSize: "24px 24px",
  maskImage: "radial-gradient(ellipse at center, black 30%, transparent 72%)",
  WebkitMaskImage: "radial-gradient(ellipse at center, black 30%, transparent 72%)",
};

// Pola titik sebagai latar 1 section per halaman (DESIGN.md 6.1). Di belakang konten, tidak di
// belakang paragraf panjang; disembunyikan di mobile (6.2). Induk harus relative.
export function DotPattern({ decor = true, className }: { decor?: boolean; className?: string }) {
  if (!decor) return null;
  return (
    <div
      aria-hidden
      style={DOT_STYLE}
      className={cn("pointer-events-none absolute inset-0 z-0 hidden md:block", className)}
    />
  );
}
