import { describe, expect, it } from "vitest";
import { allocateUniqueGallery, type GalleryCategoryInput } from "./category-gallery-allocate";

const cat = (id: string, mediaIds: string[]): GalleryCategoryInput => ({
  id,
  candidates: mediaIds.map((mediaId) => ({ mediaId, label: `${id}:${mediaId}` })),
});

const ids = (result: Map<string, { mediaId: string }[]>, id: string) => (result.get(id) ?? []).map((c) => c.mediaId);

describe("allocateUniqueGallery", () => {
  it("tiap media hanya dipakai satu kategori", () => {
    const result = allocateUniqueGallery([cat("a", ["1", "2", "3"]), cat("b", ["1", "2", "3"])], 4);
    const all = [...ids(result, "a"), ...ids(result, "b")];
    expect(new Set(all).size).toBe(all.length);
    expect(all).toHaveLength(3);
  });

  it("mengisi slot maksimum saat pilihan serakah gagal", () => {
    // Serakah: a ambil 1, b (hanya punya 1) kosong. Optimum: a ambil 2, b ambil 1.
    const result = allocateUniqueGallery([cat("a", ["1", "2"]), cat("b", ["1"])], 1);
    expect(ids(result, "a")).toEqual(["2"]);
    expect(ids(result, "b")).toEqual(["1"]);
  });

  it("merebut lewat rantai: foto dipindah supaya semua kategori terisi", () => {
    const result = allocateUniqueGallery([cat("a", ["1", "2"]), cat("b", ["2", "3"]), cat("c", ["1"])], 1);
    expect(ids(result, "c")).toEqual(["1"]);
    expect(ids(result, "a")).toHaveLength(1);
    expect(ids(result, "b")).toHaveLength(1);
  });

  it("bergiliran: kategori kecil tidak dikorbankan demi kategori yang sudah penuh", () => {
    const shared = ["1", "2", "3", "4", "5"];
    const result = allocateUniqueGallery([cat("besar", shared), cat("kecil", ["1", "2"])], 4);
    expect(ids(result, "kecil")).toHaveLength(2);
    expect(ids(result, "besar")).toEqual(["3", "4", "5"]);
  });

  it("maksimal `max` foto, urut sesuai preferensi kandidat", () => {
    const result = allocateUniqueGallery([cat("a", ["5", "4", "3", "2", "1"])], 4);
    expect(ids(result, "a")).toEqual(["5", "4", "3", "2"]);
  });

  it("melewati media yang sudah dipakai di luar rencana dan duplikat kandidat", () => {
    const result = allocateUniqueGallery([cat("a", ["1", "1", "2", "3"])], 4, new Set(["2"]));
    expect(ids(result, "a")).toEqual(["1", "3"]);
  });

  it("kategori tanpa kandidat mendapat daftar kosong", () => {
    const result = allocateUniqueGallery([cat("a", [])], 4);
    expect(result.get("a")).toEqual([]);
  });
});
