import { describe, expect, it } from "vitest";
import { pageWindow } from "@/components/public/pagination";
import { firstCategorySlug, gridCanonical, gridHref, legacyCatalogTarget, parseGridState } from "@/lib/category-grid-url";

describe("parseGridState / gridHref", () => {
  it("membaca q, huruf, dan page; nilai aneh dibuang", () => {
    expect(parseGridState({ q: "  k3   umum ", page: "3" })).toEqual({ q: "k3 umum", huruf: "", page: 3 });
    expect(parseGridState({ page: "abc" })).toEqual({ q: "", huruf: "", page: 1 });
    expect(parseGridState({ page: "-2" })).toEqual({ q: "", huruf: "", page: 1 });
    expect(parseGridState({ huruf: "b", page: "2" })).toEqual({ q: "", huruf: "B", page: 2 });
    expect(parseGridState({ huruf: "#" })).toEqual({ q: "", huruf: "#", page: 1 });
    for (const huruf of ["AB", "1", "é", ""]) expect(parseGridState({ huruf }).huruf).toBe("");
  });

  it("q dan huruf saling menggantikan: kalau keduanya ada, q yang dipakai", () => {
    expect(parseGridState({ q: "pajak", huruf: "A" })).toEqual({ q: "pajak", huruf: "", page: 1 });
    expect(gridHref({ q: "pajak", huruf: "A", page: 1 })).toBe("/pelatihan?q=pajak");
  });

  it("halaman 1 tidak ditulis; urutan parameter tetap", () => {
    expect(gridHref({ q: "", huruf: "", page: 1 })).toBe("/pelatihan");
    expect(gridHref({ q: "", huruf: "", page: 4 })).toBe("/pelatihan?page=4");
    expect(gridHref({ q: "pajak & audit", huruf: "", page: 2 })).toBe("/pelatihan?q=pajak+%26+audit&page=2");
    expect(gridHref({ q: "", huruf: "K", page: 2 })).toBe("/pelatihan?huruf=K&page=2");
    expect(gridHref({ q: "", huruf: "#", page: 1 })).toBe("/pelatihan?huruf=%23");
  });

  it("canonical per halaman; hasil cari & saringan huruf ke /pelatihan", () => {
    expect(gridCanonical({ q: "", huruf: "", page: 1 })).toBe("/pelatihan");
    expect(gridCanonical({ q: "", huruf: "", page: 3 })).toBe("/pelatihan?page=3");
    expect(gridCanonical({ q: "pajak", huruf: "", page: 2 })).toBe("/pelatihan");
    expect(gridCanonical({ q: "", huruf: "A", page: 2 })).toBe("/pelatihan");
  });
});

describe("URL katalog lama", () => {
  it("?kategori=: ambil slug valid pertama", () => {
    expect(firstCategorySlug("sdm,pajak")).toBe("sdm");
    expect(firstCategorySlug("Bukan Slug,ok")).toBe("ok");
    expect(firstCategorySlug("")).toBeNull();
    expect(firstCategorySlug(null)).toBeNull();
  });

  it("?metode=/?tipe=/?sort=/?urut=/?hal= -> /pelatihan, q dan page dipertahankan", () => {
    const target = (query: string) => legacyCatalogTarget(new URLSearchParams(query));
    expect(target("metode=online")).toBe("/pelatihan");
    expect(target("tipe=public&q=pajak&page=2")).toBe("/pelatihan?q=pajak&page=2");
    expect(target("sort=az&q=k3")).toBe("/pelatihan?q=k3");
    expect(target("urut=terbaru&hal=3")).toBe("/pelatihan?page=3");
    expect(target("q=pajak&page=2")).toBeNull();
    expect(target("")).toBeNull();
  });
});

describe("pageWindow", () => {
  it("menampilkan awal, akhir, dan sekitar halaman aktif", () => {
    expect(pageWindow(1, 1)).toEqual([1]);
    expect(pageWindow(5, 10)).toEqual([1, "gap", 4, 5, 6, "gap", 10]);
    expect(pageWindow(2, 4)).toEqual([1, 2, 3, 4]);
  });
});
