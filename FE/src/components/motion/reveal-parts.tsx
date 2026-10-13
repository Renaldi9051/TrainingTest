import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { HERO_WORD_MS, heroWordStepMs } from "./tokens";
import { RotatingWord } from "./rotating-word";

// Bagian grup reveal yang dirender server (keadaan final). Dianimasikan oleh root <Reveal> terdekat;
// tanpa root (atau tanpa JS / reduced motion) tampil apa adanya.

function splitWords(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean);
}

// Kata dalam mask: naik dari balik garis. Spasi antar kata tetap teks biasa (salin/pembaca layar utuh).
function MaskedWords({ words, wordProps }: { words: string[]; wordProps: (index: number) => Record<string, unknown> }) {
  return words.map((word, index) => (
    <span key={index}>
      {index > 0 ? " " : null}
      <span className="reveal-mask">
        <span className="inline-block" {...wordProps(index)}>
          {word}
        </span>
      </span>
    </span>
  ));
}

// Judul section: mask reveal per kata, stagger 50 ms (DESIGN.md 8.2).
export function RevealText({
  as: Tag = "h2",
  text,
  id,
  className,
}: {
  as?: "h2" | "h3" | "p";
  text: string;
  id?: string;
  className?: string;
}) {
  return (
    <Tag id={id} className={className}>
      <MaskedWords words={splitWords(text)} wordProps={() => ({ "data-reveal": "word" })} />
    </Tag>
  );
}

// Teks yang di-scramble singkat (300 ms) saat grupnya diputar: eyebrow (font mono, lebar tetap).
export function ScrambleText({ children }: { children: ReactNode }) {
  return <span data-reveal-scramble="">{children}</span>;
}

// Garis pemisah 1 px yang digambar dari kiri (scaleX). Pengganti border-top sebuah daftar.
export function LineDraw({ className }: { className?: string }) {
  return <span aria-hidden data-reveal="line" className={cn("block h-px origin-left bg-border", className)} />;
}

// Angka statistik yang berjalan 0 -> nilai saat grupnya diputar (counter 900 ms). Rata kiri: posisi
// awal teks tidak berubah saat jumlah digit bertambah (tanpa layout shift). Lebar dikunci oleh
// salinan nilai final yang tak terlihat (tanpa geser layout); angka yang berjalan aria-hidden dan
// pembaca layar langsung mendapat nilai final. Tanpa root reveal / layar pertama: angka final diam.
export function CountUp({ value, display }: { value: number; display: string }) {
  return (
    <span className="inline-grid tabular-nums">
      <span aria-hidden className="invisible col-start-1 row-start-1">
        {display}
      </span>
      <span aria-hidden data-reveal-count={value} className="col-start-1 row-start-1">
        {display}
      </span>
      <span className="sr-only">{display}</span>
    </span>
  );
}

// Bingkai gambar: wipe dari bawah + zoom 1,15 -> 1 pada <img> di dalamnya. Parent menentukan rasio.
export function RevealImage({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div data-reveal="image" className={className}>
      {children}
    </div>
  );
}

// Headline hero: reveal per kata dengan CSS murni (keyframes langsung jalan tanpa menunggu JS),
// hanya transform, total <= 500 ms. Reduced motion: tanpa animasi (lihat .hero-word di theme.css).
// accents: kata kunci (abu) di akhir judul; lebih dari satu = berganti satu putaran (RotatingWord).
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
