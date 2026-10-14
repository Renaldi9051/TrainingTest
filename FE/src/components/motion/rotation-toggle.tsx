"use client";

import { PauseIcon, PlayIcon } from "lucide-react";
import { useContext, useSyncExternalStore } from "react";
import { RotationContext } from "./rotation-context";

// Modul terpisah dari RotatingWord: tombol + ikonnya hanya ikut di JS beranda, bukan chunk reveal bersama.
const subscribeNoop = () => () => {};

// Tombol jeda/lanjut kata berganti (WCAG 2.2.2: gerak otomatis > 5 s harus bisa dihentikan).
// Dirender sejak server supaya ruangnya sudah ada (tanpa layout shift), tapi tak terlihat sampai
// hidrasi (tanpa JS tidak ada gerak). Reduced motion: disembunyikan CSS sejak paint pertama.
export function RotationToggle({ className }: { className?: string }) {
  const control = useContext(RotationContext);
  const hydrated = useSyncExternalStore(subscribeNoop, () => true, () => false);
  if (!control) return null;
  const { paused, setPaused } = control;
  const Icon = paused ? PlayIcon : PauseIcon;
  return (
    <button
      type="button"
      aria-pressed={paused}
      onClick={() => setPaused(!paused)}
      className={`inline-flex h-8 items-center gap-2 rounded-md border border-border px-2.5 font-mono text-label uppercase tracking-[0.08em] text-fg-muted outline-none transition-colors duration-150 ease-standard hover:border-border-strong hover:text-fg-strong focus-visible:ring-2 focus-visible:ring-fg-strong focus-visible:ring-offset-2 motion-reduce:hidden ${hydrated ? "" : "invisible"} ${className ?? ""}`}
    >
      <Icon aria-hidden strokeWidth={1.5} className="size-4" />
      {paused ? "Putar kata" : "Jeda kata"}
    </button>
  );
}
