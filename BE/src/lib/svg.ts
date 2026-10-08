import createDOMPurify from "dompurify";
import { JSDOM } from "jsdom";

let purifier: ReturnType<typeof createDOMPurify> | undefined;

function getPurifier() {
  purifier ??= createDOMPurify(new JSDOM("").window);
  return purifier;
}

// Sanitasi SVG di server: buang <script>, event handler (on*), javascript: URL, foreignObject, dll.
// Mengembalikan null kalau hasilnya bukan dokumen SVG.
export function sanitizeSvg(source: string): string | null {
  const clean = getPurifier().sanitize(source, {
    USE_PROFILES: { svg: true, svgFilters: true },
    FORBID_TAGS: ["foreignObject"],
  });
  const trimmed = clean.trim();
  if (!/^<svg[\s>]/i.test(trimmed)) return null;
  // File SVG mandiri butuh namespace; hasil serialisasi HTML bisa kehilangannya.
  if (!/^<svg[^>]*\sxmlns=/i.test(trimmed)) {
    return trimmed.replace(/^<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"');
  }
  return trimmed;
}
