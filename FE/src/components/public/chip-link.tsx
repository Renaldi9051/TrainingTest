import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// Chip DESIGN 7: border 1 px, radius penuh, teks small. Aktif: latar hitam teks putih.
// Berupa link (state filter di URL), jadi tetap jalan tanpa JavaScript.
export function ChipLink({
  href,
  active,
  children,
  scroll = false,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
  scroll?: boolean;
}) {
  return (
    <Link
      href={href}
      scroll={scroll}
      aria-current={active ? "true" : undefined}
      className={cn(
        "inline-flex h-8 items-center rounded-full border px-3 text-small whitespace-nowrap outline-none transition-colors duration-150",
        "focus-visible:ring-2 focus-visible:ring-fg-strong focus-visible:ring-offset-2",
        active
          ? "border-fg-strong bg-fg-strong text-inverse-fg"
          : "border-border-strong text-fg hover:border-fg-strong hover:text-fg-strong",
      )}
    >
      {children}
    </Link>
  );
}
