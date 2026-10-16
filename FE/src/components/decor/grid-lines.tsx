import { cn } from "@/lib/utils";

const COLUMNS = 12;
const MOBILE_COLUMNS = 4;

// Garis kolom grid tipis di latar halaman (DESIGN.md 6.1): 12 kolom desktop, 4 kolom mobile, lebar
// dan padding sama dengan Container supaya konten menempel ke garis. Pasang di dalam elemen
// `relative isolate` dengan className "-z-10": garis di belakang semua isi (layout publik).
export function GridLines({
  decor = true,
  tone = "light",
  className,
}: {
  decor?: boolean;
  tone?: "light" | "inverse";
  className?: string;
}) {
  if (!decor) return null;
  const line = tone === "inverse" ? "border-inverse-line" : "border-grid-line";
  return (
    // Palet C: garis lebih samar (--grid-opacity 0,45 di halaman publik; tetap 1 px).
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 z-0 opacity-[var(--grid-opacity,1)]", className)}>
      <div className="mx-auto grid h-full w-full max-w-[1280px] grid-cols-4 px-4 sm:px-6 md:grid-cols-12">
        {Array.from({ length: COLUMNS }, (_, index) => (
          <span
            key={index}
            className={cn(
              "border-l",
              line,
              index >= MOBILE_COLUMNS && "hidden md:block",
              // Kolom terakhir punya garis kanan: kolom ke-4 di mobile, ke-12 di desktop.
              index === MOBILE_COLUMNS - 1 && "border-r md:border-r-0",
              index === COLUMNS - 1 && "border-r",
            )}
          />
        ))}
      </div>
    </div>
  );
}
