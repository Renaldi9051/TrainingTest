import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// Bagian grup reveal yang dirender server (keadaan final). Dianimasikan oleh root <Reveal> terdekat;
// tanpa root (atau tanpa JS / reduced motion) tampil apa adanya.

export function splitWords(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean);
}

// Kata dalam mask: naik dari balik garis. Spasi antar kata tetap teks biasa (salin/pembaca layar utuh).
export function MaskedWords({ words, wordProps }: { words: string[]; wordProps: (index: number) => Record<string, unknown> }) {
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
