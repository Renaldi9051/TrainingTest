import { cn } from "@/lib/utils";
import { formatIndex } from "./decor-plan";

// Nomor mono besar sebagai jangkar visual baris (DESIGN.md 6.1): baris layanan, keunggulan,
// testimoni. Urutan sudah disampaikan oleh daftar (<ol>/<ul>), jadi nomornya dekoratif.
export function IndexNumber({
  position,
  size = "md",
  className,
}: {
  position: number;
  size?: "md" | "lg";
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "font-mono leading-none font-medium text-fg-strong",
        size === "md" ? "text-[32px] tracking-[-0.04em] md:text-[56px]" : "text-[72px] tracking-[-0.06em] md:text-[120px]",
        className,
      )}
    >
      {formatIndex(position)}
    </span>
  );
}
