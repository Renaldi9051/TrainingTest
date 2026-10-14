import { describe, expect, it } from "vitest";
import type { PublicSearchResult } from "@/lib/api/types";
import { buildPublicPaletteGroups, catalogSearchHref, publicSearchHref } from "@/lib/public-search";

const result: PublicSearchResult = {
  q: "pilot",
  groups: [
    { group: "trainings", items: [{ slug: "pilot-dasar", title: "Pilot dasar", meta: "Pilot Drone" }] },
    { group: "categories", items: [{ slug: "pilot-drone", title: "Pilot Drone", meta: null, trainingCount: 1200 }] },
    { group: "services", items: [{ slug: "in-house", title: "In-house", meta: "Pelatihan di lokasi klien" }] },
  ],
};

describe("palette search publik", () => {
  it("URL tujuan: detail pelatihan, landing kategori, detail layanan, katalog dengan ?q=", () => {
    expect(publicSearchHref("trainings", "pilot-dasar")).toBe("/pelatihan/pilot-dasar");
    expect(publicSearchHref("categories", "pilot-drone")).toBe("/pelatihan/kategori/pilot-drone");
    expect(publicSearchHref("services", "in-house")).toBe("/layanan/in-house");
    expect(catalogSearchHref(" pilot & drone ")).toBe("/pelatihan?q=pilot%20%26%20drone");
  });

  it("grup Pelatihan, Kategori (jumlah pelatihan), Layanan, lalu tautan ke katalog", () => {
    const groups = buildPublicPaletteGroups("pilot", result);
    expect(groups.map((group) => group.label)).toEqual(["Pelatihan", "Kategori", "Layanan", "Katalog"]);
    expect(groups[1].items[0]).toMatchObject({ title: "Pilot Drone", meta: "1.200 pelatihan", href: "/pelatihan/kategori/pilot-drone" });
    expect(groups[3].items[0]).toMatchObject({ href: "/pelatihan?q=pilot", title: 'Lihat semua hasil untuk "pilot"' });
  });

  it("kurang dari 2 huruf, sedang memuat, atau tanpa hasil: tidak ada grup (palette menampilkan statusnya)", () => {
    expect(buildPublicPaletteGroups("p", result)).toEqual([]);
    expect(buildPublicPaletteGroups("pilot", null)).toEqual([]);
    expect(buildPublicPaletteGroups("xyz", { q: "xyz", groups: [] })).toEqual([]);
  });
});
