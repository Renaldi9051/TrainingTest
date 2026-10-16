"use client";

import { useSyncExternalStore } from "react";

// Status jeda hero bersama (DESIGN.md 8.1 & 9.2): satu tombol pause/play menghentikan slideshow DAN
// kata berganti (WCAG 2.2.2). Store modul (bukan context) supaya RotatingWord di dalam h1 yang
// dirender server dan tombol di HeroSlideshow/HeroPauseButton tidak perlu induk client bersama.
// Bertahan selama sesi tab (navigasi klien), seperti pilihan pengguna lainnya.

let paused = false;
const listeners = new Set<() => void>();

export function getHeroPaused(): boolean {
  return paused;
}

export function setHeroPaused(value: boolean): void {
  if (paused === value) return;
  paused = value;
  listeners.forEach((listener) => listener());
}

export function subscribeHeroPaused(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Server & hidrasi: belum dijeda.
export function useHeroPaused(): boolean {
  return useSyncExternalStore(subscribeHeroPaused, getHeroPaused, () => false);
}
