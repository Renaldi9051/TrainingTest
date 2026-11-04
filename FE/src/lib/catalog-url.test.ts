import { describe, expect, it } from "vitest";
import { pageWindow } from "@/components/public/pagination";
import {
  catalogCanonical,
  catalogHref,
  parseCatalogState,
} from "@/lib/catalog-url";

describe("parseCatalogState", () => {
  it("membaca parameter URL katalog", () => {
    expect(
      parseCatalogState({ q: " pajak ", kategori: "keuangan,pajak,keuangan", metode: "Online", tipe: "in-house", urut: "az", hal: "3" }),
    ).toEqual({ q: "pajak", kategori: ["keuangan", "pajak"], metode: "online", tipe: "in-house", urut: "az", hal: 3 });
  });

  it("membuang nilai yang tidak dikenal", () => {
    expect(
      parseCatalogState({ kategori: "Bukan Slug,ok,<script>", metode: "teleport", tipe: "x", urut: "acak", hal: "-2" }),
    ).toEqual({ q: "", kategori: ["ok"], metode: null, tipe: null, urut: null, hal: 1 });
  });
});

describe("catalogHref", () => {
  // Kategori di state tetap diparse (dipakai redirect), tapi catalogHref tidak pernah menuliskannya:
  // kategori bukan parameter katalog lagi (keputusan atasan 4 Nov 2026).
  const state = parseCatalogState({ q: "kpi", kategori: "sdm", hal: "4" });

  it("urutan parameter tetap, tanpa kategori, filter baru kembali ke halaman 1", () => {
    expect(catalogHref(state, { metode: "offline" })).toBe("/pelatihan?q=kpi&metode=offline");
    expect(catalogHref(state, { hal: 5 })).toBe("/pelatihan?q=kpi&hal=5");
    expect(catalogHref(state, { tipe: "in-house" })).toBe("/pelatihan?q=kpi&tipe=in-house");
    expect(catalogHref(parseCatalogState({}))).toBe("/pelatihan");
  });
});

describe("catalogCanonical", () => {
  it("satu kategori saja -> landing kategori; selain itu /pelatihan", () => {
    expect(catalogCanonical(parseCatalogState({ kategori: "sdm" }))).toBe("/pelatihan/kategori/sdm");
    expect(catalogCanonical(parseCatalogState({ kategori: "sdm", urut: "az", hal: "2" }))).toBe("/pelatihan/kategori/sdm");
    expect(catalogCanonical(parseCatalogState({ kategori: "sdm,pajak" }))).toBe("/pelatihan");
    expect(catalogCanonical(parseCatalogState({ kategori: "sdm", q: "kpi" }))).toBe("/pelatihan");
    expect(catalogCanonical(parseCatalogState({}))).toBe("/pelatihan");
  });
});

describe("pageWindow", () => {
  it("menampilkan awal, akhir, dan sekitar halaman aktif", () => {
    expect(pageWindow(1, 1)).toEqual([1]);
    expect(pageWindow(5, 10)).toEqual([1, "gap", 4, 5, 6, "gap", 10]);
    expect(pageWindow(2, 4)).toEqual([1, 2, 3, 4]);
  });
});
