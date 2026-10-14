import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Skala tipografi kustom (theme.css: --text-label/small/body/body-lg) adalah ukuran font, bukan
// warna. Tanpa ini tailwind-merge membuang warna teks (mis. text-inverse-fg) saat ada text-small.
const twMerge = extendTailwindMerge({
  extend: { classGroups: { "font-size": [{ text: ["label", "small", "body", "body-lg"] }] } },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
