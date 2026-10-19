import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// components/ui juga dirender di admin (/admin/dev/ui, pencarian admin). Di admin, --accent adalah
// token shadcn (latar hover), bukan oranye palet C, dan token palet C lain tidak dideklarasikan.
// Jadi komponen di sini hanya boleh memakai warna peran yang punya fallback netral di theme.css
// (primary, primary-hover, on-primary, focus, cta, accent-ink, ...), bukan utilitas accent polos.
const dir = new URL("./", import.meta.url);
const files = readdirSync(dir).filter((name) => name.endsWith(".tsx"));

describe("palet C: components/ui aman untuk admin", () => {
  it.each(files)("%s tidak memakai utilitas --accent polos", (name) => {
    const source = readFileSync(new URL(name, dir), "utf8");
    expect(source).not.toMatch(/\b(?:bg|text|border|ring|outline|fill|stroke|from|via|to|decoration|caret|divide)-accent(?![\w-])/);
    expect(source).not.toMatch(/var\(--accent\)/);
  });
});
