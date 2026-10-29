import { cn } from "@/lib/utils";

// Tanda + 12 px di titik temu garis grid & sudut section/gambar (DESIGN.md 6.1). Posisi lewat
// className (mis. "-top-1.5 -left-1.5" supaya titik tengahnya tepat di sudut). Induk harus relative.
export function PlusMarker({ decor = true, className }: { decor?: boolean; className?: string }) {
  if (!decor) return null;
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute size-3",
        "before:absolute before:top-0 before:left-[5.5px] before:h-3 before:w-px before:bg-current",
        "after:absolute after:top-[5.5px] after:left-0 after:h-px after:w-3 after:bg-current",
        // Palet D: token peran --decor-mark (--primary di latar terang, mustard di permukaan gelap).
        "text-decor-mark",
        className,
      )}
    />
  );
}
