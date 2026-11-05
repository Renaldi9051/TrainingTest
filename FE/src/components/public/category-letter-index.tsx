import { ActiveIndicator } from "@/components/motion/active-indicator";
import { gridHref, INDEX_LETTERS } from "@/lib/category-grid-url";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ChipLink } from "./chip-link";
import { ScrollToActive } from "./scroll-to-active";

const LETTER_CHIP = "min-w-8 justify-center px-2 font-mono";

// Nama huruf untuk pembaca layar ("#" = nama berawalan angka/simbol).
function letterName(letter: string): string {
  return letter === "#" ? "Angka dan simbol" : `Huruf ${letter}`;
}

// Indeks huruf A-Z di atas grid /pelatihan (keputusan pemilik 5 Nov 2026). Tiap huruf berupa link
// ?huruf= (state di URL, tetap jalan tanpa JavaScript), aktif = chip --primary dengan indikator yang
// bergeser (DESIGN.md 8.7, FLIP lewat ActiveIndicator). Huruf tanpa kategori tampil redup dan tidak
// bisa diklik. Di mobile baris di-scroll ke samping dan huruf aktif digeser ke tengah (ScrollToActive);
// indikator ada di elemen dalam (w-max) yang tidak ikut di-scroll, supaya posisinya dihitung benar.
// counts: jumlah kategori publik per huruf (indexLetter, sama dengan BE categoryIndexLetter).
export function CategoryLetterIndex({ counts, active }: { counts: Readonly<Record<string, number>>; active: string }) {
  return (
    <ScrollToActive
      activeKey={active}
      label="Indeks huruf kategori"
      className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:overflow-visible sm:px-0"
    >
      <ActiveIndicator variant="pill" className="flex w-max gap-1.5 py-1 sm:w-auto sm:flex-wrap">
        <ChipLink href={gridHref({ q: "", huruf: "", page: 1 })} active={!active}>
          Semua
        </ChipLink>
        {INDEX_LETTERS.map((letter) => {
          const count = counts[letter] ?? 0;
          if (count === 0) {
            return (
              <span
                key={letter}
                aria-disabled="true"
                data-letter={letter}
                className={cn(
                  "inline-flex h-8 items-center rounded-full border border-border text-small text-fg-subtle select-none",
                  LETTER_CHIP,
                )}
              >
                <span aria-hidden>{letter}</span>
                <span className="sr-only">{letterName(letter)}, tidak ada kategori</span>
              </span>
            );
          }
          return (
            <ChipLink
              key={letter}
              href={gridHref({ q: "", huruf: letter, page: 1 })}
              active={active === letter}
              label={`${letterName(letter)}, ${formatNumber(count)} kategori`}
              className={LETTER_CHIP}
            >
              {letter}
            </ChipLink>
          );
        })}
      </ActiveIndicator>
    </ScrollToActive>
  );
}
