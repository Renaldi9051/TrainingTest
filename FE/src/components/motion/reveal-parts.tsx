import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { HERO_WORD_MS, heroWordStepMs } from "./tokens";

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
export function HeroWords({ text, accent }: { text: string; accent?: string }) {
  const words = splitWords(text);
  const accentWords = accent ? splitWords(accent) : [];
  const all = [...words, ...accentWords];
  const style = { "--hero-step": `${heroWordStepMs(all.length)}ms`, "--hero-word": `${HERO_WORD_MS}ms` } as CSSProperties;
  return (
    <span style={style}>
      <MaskedWords
        words={all}
        wordProps={(index) => ({
          className: cn("hero-word inline-block", index >= words.length && "text-fg-muted"),
          style: { "--i": index } as CSSProperties,
        })}
      />
    </span>
  );
}
