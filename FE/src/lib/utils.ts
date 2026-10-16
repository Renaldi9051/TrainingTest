import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Skala tipografi kustom (theme.css: --text-*) adalah ukuran font, bukan warna. Tanpa ini
// tailwind-merge membuang warna teks (mis. text-inverse-fg) saat ada text-small.
export const FONT_SIZE_TOKENS = ["label", "small", "body", "body-lg", "h3", "h2", "h1", "display", "mega"] as const;

// Radius kustom: rounded-card (radius kartu palet C di theme.css) satu grup dengan rounded-md dkk.
const twMerge = extendTailwindMerge({
  extend: {
    theme: { radius: ["card"] },
    classGroups: { "font-size": [{ text: [...FONT_SIZE_TOKENS] }] },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
