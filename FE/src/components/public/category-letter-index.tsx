import Link from "next/link";
import type { ReactNode } from "react";
import { ActiveIndicator } from "@/components/motion/active-indicator";
import { gridHref, INDEX_LETTERS } from "@/lib/category-grid-url";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ScrollToActive } from "./scroll-to-active";

// Nama huruf untuk pembaca layar ("#" = nama berawalan angka/simbol).
function letterName(letter: string): string {
  return letter === "#" ? "Angka dan simbol" : `Huruf ${letter}`;
}

function LetterLink({ href, active, label, wide, children }: { href: string; active: boolean; label?: string; wide?: boolean; children: ReactNode }) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? "true" : undefined}
      aria-label={label}
      className={cn(
        "relative inline-flex h-10 min-w-10 shrink-0 items-center justify-center rounded-md text-fg-strong outline-none",
        "transition-colors duration-150 [[data-indicator-ready]_&]:duration-300",
        "focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2",
        wide ? "px-3.5 text-small" : "font-mono text-small",
        // Aktif: kotak --primary (indikator yang bergeser di dalam ActiveIndicator; tanpa JS latar sendiri).
        active ? "bg-primary text-on-primary [[data-indicator-ready]_&]:bg-transparent" : "hover:bg-bg-subtle",
      )}
    >
      {children}
    </Link>
  );
}

// Indeks huruf A-Z di toolbar grid /pelatihan (mockup redesign 5 Nov 2026): kotak 40 px mono, aktif
// --primary dengan indikator yang bergeser (FLIP, ActiveIndicator). Hanya huruf yang punya kategori
// yang tampil. Tiap huruf berupa link ?huruf= (tetap jalan tanpa JavaScript). Baris di-scroll ke
// samping kalau meluap, huruf aktif digeser ke tengah (ScrollToActive); indikator ada di elemen dalam
// (w-max) yang ikut bergeser bersama isinya, supaya posisinya dihitung benar.
// counts: jumlah kategori publik per huruf (indexLetter, sama dengan BE categoryIndexLetter).
export function CategoryLetterIndex({
  counts,
  active,
  className,
}: {
  counts: Readonly<Record<string, number>>;
  active: string;
  className?: string;
}) {
  return (
    <ScrollToActive
      activeKey={active}
      label="Indeks huruf kategori"
      className={cn("min-w-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", className)}
    >
      <ActiveIndicator variant="pill" indicatorClassName="rounded-md" className="flex w-max gap-1.5">
        <LetterLink href={gridHref({ q: "", huruf: "", page: 1 })} active={!active} wide>
          Semua
        </LetterLink>
        {INDEX_LETTERS.filter((letter) => (counts[letter] ?? 0) > 0).map((letter) => (
          <LetterLink
            key={letter}
            href={gridHref({ q: "", huruf: letter, page: 1 })}
            active={active === letter}
            label={`${letterName(letter)}, ${formatNumber(counts[letter] ?? 0)} kategori`}
          >
            {letter}
          </LetterLink>
        ))}
      </ActiveIndicator>
    </ScrollToActive>
  );
}
