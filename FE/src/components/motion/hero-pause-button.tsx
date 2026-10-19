"use client";

import { PauseIcon, PlayIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { setHeroPaused, useHeroPaused } from "./hero-playback";

// Tombol pause/play hero (WCAG 2.2.2): menghentikan & melanjutkan slideshow dan kata berganti
// sekaligus (hero-playback.ts). Disembunyikan saat reduced motion (tidak ada yang bergerak).
// subject: apa yang dijeda, untuk nama aksesibel ("slideshow" atau "kata berganti").
export function HeroPauseButton({ subject, className }: { subject: string; className?: string }) {
  const paused = useHeroPaused();
  return (
    <button
      type="button"
      onClick={() => setHeroPaused(!paused)}
      aria-label={paused ? `Putar ${subject}` : `Jeda ${subject}`}
      data-hero-pause=""
      className={cn(
        "inline-flex size-10 shrink-0 items-center justify-center rounded-md border outline-none transition-colors duration-150 ease-standard focus-visible:ring-2 focus-visible:ring-current focus-visible:ring-offset-2 motion-reduce:hidden",
        className,
      )}
    >
      {paused ? <PlayIcon aria-hidden strokeWidth={1.5} className="size-4" /> : <PauseIcon aria-hidden strokeWidth={1.5} className="size-4" />}
    </button>
  );
}
