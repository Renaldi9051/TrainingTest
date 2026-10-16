import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const CORNERS = [
  { position: "top-0 left-0 border-t-[1.5px] border-l-[1.5px]", away: "group-hover:translate-0 -translate-x-1.5 -translate-y-1.5" },
  { position: "top-0 right-0 border-t-[1.5px] border-r-[1.5px]", away: "group-hover:translate-0 translate-x-1.5 -translate-y-1.5" },
  { position: "bottom-0 left-0 border-b-[1.5px] border-l-[1.5px]", away: "group-hover:translate-0 -translate-x-1.5 translate-y-1.5" },
  { position: "bottom-0 right-0 border-b-[1.5px] border-r-[1.5px]", away: "group-hover:translate-0 translate-x-1.5 translate-y-1.5" },
] as const;

// Bingkai viewfinder (DESIGN.md 6.1): 4 sudut siku (24 px, kartu 12 px), crosshair opsional di
// tengah, label mono opsional di sudut atas. Dipasang di dalam kotak gambar `relative`; `className`
// mengatur jarak ke tepi (default inset 16 px).
// - tone "photo": sudut --accent di atas foto lebar; "plain": putih di foto kartu; "dark": --primary di
//   atas latar terang (palet C v0.3).
// - hover: kartu (induk `group`) — tersembunyi, sudut bergerak dari luar ke posisinya saat hover.
export function Viewfinder({
  decor = true,
  size = "md",
  tone = "photo",
  crosshair = false,
  hover = false,
  topLeft,
  topRight,
  className,
}: {
  decor?: boolean;
  size?: "sm" | "md";
  // photo: sudut --accent di atas foto lebar (hero, detail, landing kategori); plain: putih di foto
  // kartu (palet C); dark: --primary di latar terang (kartu tanpa sampul).
  tone?: "photo" | "plain" | "dark";
  crosshair?: boolean;
  hover?: boolean;
  topLeft?: ReactNode;
  topRight?: ReactNode;
  className?: string;
}) {
  if (!decor) return null;
  // Palet C: sudut --accent di atas foto, --primary di latar terang (DESIGN.md 6, v0.3).
  const color = tone === "photo" ? "border-accent" : tone === "plain" ? "border-inverse-fg/90" : "border-primary";
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute",
        size === "md" ? "inset-4" : "inset-3",
        hover &&
          "opacity-0 transition-opacity duration-300 ease-standard group-hover:opacity-100 group-focus-within:opacity-100",
        className,
      )}
    >
      {CORNERS.map((corner) => (
        <span
          key={corner.position}
          className={cn(
            "absolute",
            size === "md" ? "size-6" : "size-3",
            corner.position,
            color,
            hover && "transition-transform duration-300 ease-standard motion-reduce:translate-0",
            hover && corner.away,
            hover && "group-focus-within:translate-0",
          )}
        />
      ))}
      {crosshair ? (
        <span
          className={cn(
            "absolute top-1/2 left-1/2 size-5 -translate-1/2",
            "before:absolute before:top-0 before:left-[9.5px] before:h-5 before:w-px",
            "after:absolute after:top-[9.5px] after:left-0 after:h-px after:w-5",
            tone === "dark" ? "before:bg-primary after:bg-primary" : tone === "plain" ? "before:bg-inverse-fg/75 after:bg-inverse-fg/75" : "before:bg-accent after:bg-accent",
          )}
        />
      ) : null}
      {topLeft ? <div className="absolute top-3 left-9">{topLeft}</div> : null}
      {topRight ? <div className="absolute top-3 right-9">{topRight}</div> : null}
    </div>
  );
}
