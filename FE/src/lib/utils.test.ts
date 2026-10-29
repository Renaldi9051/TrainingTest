import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { cn, FONT_SIZE_TOKENS } from "@/lib/utils";

describe("cn", () => {
  it("ukuran font kustom tidak menghapus warna teks", () => {
    expect(cn("text-inverse-fg text-small")).toBe("text-inverse-fg text-small");
    expect(cn("text-fg-strong", "text-body-lg")).toBe("text-fg-strong text-body-lg");
    expect(cn("text-label text-fg-muted")).toBe("text-label text-fg-muted");
  });

  it("ukuran font kustom saling menggantikan, warna juga", () => {
    expect(cn("text-small", "text-body")).toBe("text-body");
    expect(cn("text-fg", "text-fg-muted")).toBe("text-fg-muted");
  });

  it("skala judul v0.2 juga ukuran font", () => {
    expect(cn("text-h1 text-inverse-fg")).toBe("text-h1 text-inverse-fg");
    expect(cn("text-mega", "text-transparent")).toBe("text-mega text-transparent");
    expect(cn("text-h2", "text-display")).toBe("text-display");
  });

  it("palet D: warna peran baru tetap warna, rounded-card satu grup dengan radius lain", () => {
    expect(cn("bg-fg-strong", "bg-primary")).toBe("bg-primary");
    expect(cn("text-small text-on-primary")).toBe("text-small text-on-primary");
    expect(cn("text-fg-muted", "text-primary-ink")).toBe("text-primary-ink");
    expect(cn("text-small text-secondary")).toBe("text-small text-secondary");
    expect(cn("bg-secondary text-on-secondary")).toBe("bg-secondary text-on-secondary");
    expect(cn("border-primary", "border-decor-mark")).toBe("border-decor-mark");
    expect(cn("ring-fg-strong", "ring-focus")).toBe("ring-focus");
    expect(cn("rounded-md", "rounded-card")).toBe("rounded-card");
    expect(cn("rounded-card", "rounded-full")).toBe("rounded-full");
  });

  it("semua token --text-* di theme.css terdaftar di tailwind-merge", () => {
    const css = readFileSync(new URL("../app/theme.css", import.meta.url), "utf8");
    const tokens = [...css.matchAll(/^\s*--text-([a-z0-9]+(?:-[a-z0-9]+)*):/gm)].map((match) => match[1]);
    expect(new Set(tokens)).toEqual(new Set(FONT_SIZE_TOKENS));
  });
});
