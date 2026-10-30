import { cn } from "@/lib/utils";

const CORNERS = [
  "top-0 left-0 border-t-[1.5px] border-l-[1.5px]",
  "top-0 right-0 border-t-[1.5px] border-r-[1.5px]",
  "bottom-0 left-0 border-b-[1.5px] border-l-[1.5px]",
  "bottom-0 right-0 border-b-[1.5px] border-r-[1.5px]",
];

// Tanda viewfinder kecil (4 sudut + titik) di samping nama situs, hanya selama logo belum diisi di
// pengaturan (bukan pengganti logo). Warna mengikuti teks (currentColor).
export function BrandMark({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn("relative inline-block size-[22px] shrink-0", className)}>
      {CORNERS.map((corner) => (
        <span key={corner} className={cn("absolute size-2 border-current", corner)} />
      ))}
      <span className="absolute top-[9px] left-[9px] size-1 rounded-full bg-decor-mark" />
    </span>
  );
}
