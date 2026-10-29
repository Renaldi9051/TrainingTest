import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// components/ui juga dirender di admin (/admin/dev/ui, pencarian admin). Di admin, --accent dan
// --secondary adalah token shadcn (latar hover, latar abu), bukan mustard/biru tua palet D, dan token
// palet D lain tidak dideklarasikan. Jadi komponen di sini hanya boleh memakai warna peran yang punya
// fallback netral di theme.css (primary, primary-hover, on-primary, primary-ink, focus, cta, link, ...),
// bukan utilitas accent atau secondary polos.
const dir = new URL("./", import.meta.url);
const files = readdirSync(dir).filter((name) => name.endsWith(".tsx"));
const UTILITY = "(?:bg|text|border|ring|outline|fill|stroke|from|via|to|decoration|caret|divide)";

describe("palet D: components/ui aman untuk admin", () => {
  it.each(files)("%s tidak memakai utilitas --accent polos", (name) => {
    const source = readFileSync(new URL(name, dir), "utf8");
    expect(source).not.toMatch(new RegExp(`\\b${UTILITY}-accent(?![\\w-])`));
    expect(source).not.toMatch(/var\(--accent\)/);
  });

  // Nama varian tombol "secondary" (buttonVariants) boleh; yang dilarang utilitas warnanya.
  it.each(files)("%s tidak memakai utilitas --secondary polos", (name) => {
    const source = readFileSync(new URL(name, dir), "utf8");
    expect(source).not.toMatch(new RegExp(`\\b${UTILITY}-secondary(?![\\w-])`));
    expect(source).not.toMatch(/var\(--secondary\)/);
  });
});
