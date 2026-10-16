import { cn } from "@/lib/utils";

// Noise SVG statis, ubin 160 px tanpa sambungan (stitchTiles). Saturasi 0 supaya tetap monokrom.
// Sebagai data URI, id filter-nya lokal di gambar itu sendiri (tidak bentrok antar komponen).
const GRAIN_SVG =
  "<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'>" +
  "<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/>" +
  "<feColorMatrix type='saturate' values='0'/></filter>" +
  "<rect width='100%' height='100%' filter='url(%23n)'/></svg>";

const GRAIN_STYLE = { backgroundImage: `url("data:image/svg+xml,${GRAIN_SVG}")` };

// Tekstur grain (DESIGN.md 6.1): opacity 4% di latar terang, 6% di section hitam, 7% (overlay
// blend) di atas foto hero. Induk harus relative.
export function GrainOverlay({
  decor = true,
  tone = "light",
  className,
}: {
  decor?: boolean;
  tone?: "light" | "inverse" | "photo";
  className?: string;
}) {
  if (!decor) return null;
  return (
    <div
      aria-hidden
      style={GRAIN_STYLE}
      className={cn(
        "pointer-events-none absolute inset-0",
        tone === "light" && "opacity-[0.04]",
        tone === "inverse" && "opacity-[0.06]",
        tone === "photo" && "opacity-[0.07] mix-blend-overlay",
        className,
      )}
    />
  );
}
