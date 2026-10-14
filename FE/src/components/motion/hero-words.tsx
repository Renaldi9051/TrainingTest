import type { CSSProperties } from "react";
import { MaskedWords, splitWords } from "./reveal-parts";
import { RotatingWord } from "./rotating-word";
import { HERO_WORD_MS, heroWordStepMs } from "./tokens";

// Modul terpisah dari reveal-parts (dipakai semua halaman): RotatingWord dan loop-nya hanya ikut di JS
// beranda.

// Headline hero: reveal per kata dengan CSS murni (keyframes langsung jalan tanpa menunggu JS),
// hanya transform, total <= 500 ms. Reduced motion: tanpa animasi (lihat .hero-word di theme.css).
// accents: kata kunci (abu) di akhir judul; lebih dari satu = berganti terus tiap 3 s (RotatingWord).
export function HeroWords({ text, accents = [] }: { text: string; accents?: string[] }) {
  const words = splitWords(text);
  const rotating = accents.map((accent) => accent.trim()).filter(Boolean);
  const count = words.length + (rotating.length > 0 ? 1 : 0);
  const style = { "--hero-step": `${heroWordStepMs(count)}ms`, "--hero-word": `${HERO_WORD_MS}ms` } as CSSProperties;
  return (
    <span style={style}>
      <MaskedWords
        words={words}
        wordProps={(index) => ({ className: "hero-word inline-block", style: { "--i": index } as CSSProperties })}
      />
      {rotating.length > 0 ? (
        <span>
          {words.length > 0 ? " " : null}
          <span className="reveal-mask">
            <span className="hero-word inline-block text-fg-muted" style={{ "--i": words.length } as CSSProperties}>
              {rotating.length > 1 ? <RotatingWord words={rotating} /> : rotating[0]}
            </span>
          </span>
        </span>
      ) : null}
    </span>
  );
}
