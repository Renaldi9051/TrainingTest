import { describe, expect, it } from "vitest";
import type { PublicPageBlock } from "@/lib/api/types";
import { blockAnchor, tocEntries, updatedLabel } from "@/lib/static-page-plan";

const text = (id: string, heading: string): PublicPageBlock => ({ id, type: "RICH_TEXT", eyebrow: "", heading, bodyHtml: "<p>x</p>" });

describe("daftar isi halaman statis", () => {
  it("dari judul blok yang berisi; anchor mengikuti urutan blok", () => {
    const blocks = [text("a", "Pengumpulan data"), text("b", ""), text("c", " Penggunaan data ")];
    expect(tocEntries(blocks)).toEqual([
      { id: "bagian-1", label: "Pengumpulan data" },
      { id: "bagian-3", label: "Penggunaan data" },
    ]);
    expect(blockAnchor(0)).toBe("bagian-1");
  });

  it("kurang dari 2 judul: tanpa daftar isi", () => {
    expect(tocEntries([text("a", "Satu-satunya")])).toEqual([]);
    expect(tocEntries([])).toEqual([]);
  });

  it("label diperbarui dalam WIB", () => {
    // 30 Sep 20:00 UTC = 1 Okt 03:00 WIB.
    expect(updatedLabel("2026-09-30T20:00:00.000Z")).toBe("01 OKT 2026");
  });
});
