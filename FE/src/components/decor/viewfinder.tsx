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
// - tone "photo": garis terang di atas foto; "dark": garis hitam di atas latar terang.
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
  tone?: "photo" | "dark";
  crosshair?: boolean;
  hover?: boolean;
  topLeft?: ReactNode;
  topRight?: ReactNode;
  className?: string;
}) {
  if (!decor) return null;
  const color = tone === "photo" ? "border-inverse-fg/90" : "border-fg-strong";
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
            tone === "photo" ? "before:bg-inverse-fg/75 after:bg-inverse-fg/75" : "before:bg-fg-strong after:bg-fg-strong",
          )}
        />
      ) : null}
      {topLeft ? <div className="absolute top-3 left-9">{topLeft}</div> : null}
      {topRight ? <div className="absolute top-3 right-9">{topRight}</div> : null}
    </div>
  );
}
