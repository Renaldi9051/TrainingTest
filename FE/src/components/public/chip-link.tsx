import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// Chip DESIGN 7: border 1 px, radius penuh, teks small. Aktif: latar hitam teks putih.
// Berupa link (state filter di URL), jadi tetap jalan tanpa JavaScript. Di dalam ActiveIndicator
// (filter pilih satu) latar hitam diganti indikator yang bergeser, teksnya ikut berganti 300 ms.
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
        "relative inline-flex h-8 items-center rounded-full border px-3 text-small whitespace-nowrap outline-none transition-colors duration-150 [[data-indicator-ready]_&]:duration-300",
        "focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2",
        // Palet D: aktif --primary (indikator pill di dalam ActiveIndicator), hover garis --primary & teks --primary-ink.
        active
          ? "border-primary bg-primary text-on-primary [[data-indicator-ready]_&]:bg-transparent"
          : "border-border-strong text-fg hover:border-primary hover:text-primary-ink",
      )}
    >
      {children}
    </Link>
  );
}
