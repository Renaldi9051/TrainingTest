import { ArrowUpRightIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { badgeRingChars } from "./badge-ring";

// Badge berputar (DESIGN.md 6.1): lingkaran 120 px berisi teks melingkar mono dengan panah di
// tengah, berputar 360 derajat per 20 s; hover: putaran melambat & panah bergeser. Berupa link CTA
// (bisa difokus), teks melingkarnya dekoratif; nama aksesibelnya dari `label`. Mobile 50%
// (origin sudut, default kanan bawah). Reduced motion: diam (motion-safe).
// - tone "light": di atas foto/section gelap (cincin --accent-on-dark, inti mustard). Di permukaan biru
//   (CTA penutup) cincin & ring fokus otomatis --on-secondary lewat data-surface="secondary".
// - tone "dark": di atas latar terang (inti --primary).
export function RotatingBadge({
  href,
  text,
  label,
  decor = true,
  tone = "light",
  className,
}: {
  href: string;
  text: string | null | undefined;
  label?: string;
  decor?: boolean;
  tone?: "light" | "dark";
  className?: string;
}) {
  const chars = badgeRingChars(text ?? "");
  if (!decor || chars.length === 0) return null;
  return (
    <Link
      href={href}
      aria-label={label ?? text ?? undefined}
      className={cn(
        "group/badge absolute block size-[120px] origin-bottom-right rounded-full outline-none max-md:scale-50",
        "focus-visible:ring-2 focus-visible:ring-offset-2",
        // Palet D: di atas foto/section gelap teks cincin --accent-on-dark & inti --accent; di latar
        // terang inti --primary.
        tone === "light"
          ? "text-accent-on-dark focus-visible:ring-focus-dark focus-visible:ring-offset-inverse-bg"
          : "text-fg-strong focus-visible:ring-focus",
        className,
      )}
    >
      <span aria-hidden className="absolute inset-0 motion-safe:animate-badge-spin">
        <span className="absolute inset-0 [animation-play-state:paused] group-hover/badge:[animation-play-state:running] motion-safe:animate-badge-counter">
          {chars.map(({ char, angle }, index) => (
            <span
              key={index}
              style={{ transform: `translateX(-50%) rotate(${angle}deg)` }}
              className="absolute top-3.5 left-1/2 h-[46px] origin-bottom font-mono text-[10.5px] leading-none font-medium"
            >
              {char}
            </span>
          ))}
        </span>
      </span>
      <span
        aria-hidden
        className={cn(
          "absolute inset-[34px] flex items-center justify-center rounded-full",
          "transition-transform duration-300 ease-standard motion-safe:group-hover/badge:translate-x-[3px] motion-safe:group-hover/badge:-translate-y-[3px]",
          tone === "light" ? "bg-accent text-on-accent" : "bg-primary text-on-primary",
        )}
      >
        <ArrowUpRightIcon className="size-5" strokeWidth={1.5} />
      </span>
    </Link>
  );
}
