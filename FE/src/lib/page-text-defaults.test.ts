import { describe, expect, it } from "vitest";
import type { PageHeader, PageHeaderPage, TrainingsPage } from "@/lib/api/types";
import {
  PAGE_HEADER_DEFAULTS,
  TRAININGS_PAGE_DEFAULTS,
  withPageHeaderDefaults,
  withPageHeadersDefaults,
  withTrainingsPageDefaults,
} from "./page-text-defaults";

const empty: PageHeader = { eyebrow: "", heading: "", lead: "" };

describe("page-text-defaults", () => {
  it("kepala halaman kosong = teks bawaan; isi tersimpan tetap dipakai", () => {
    expect(withPageHeaderDefaults("artikel", empty)).toEqual(PAGE_HEADER_DEFAULTS.artikel);
    expect(withPageHeaderDefaults("artikel", { eyebrow: "Artikel & Galeri", heading: "Kabar", lead: "  " })).toEqual({
      eyebrow: "Artikel & Galeri",
      heading: "Kabar",
      lead: PAGE_HEADER_DEFAULTS.artikel.lead,
    });
  });

  it("semua halaman terisi untuk form admin, termasuk halaman yang belum tersimpan", () => {
    const stored = { jadwal: { eyebrow: "", heading: "Jadwal kelas", lead: "" } } as Record<PageHeaderPage, PageHeader>;
    const filled = withPageHeadersDefaults(stored);
    expect(Object.keys(filled).sort()).toEqual(Object.keys(PAGE_HEADER_DEFAULTS).sort());
    expect(filled.jadwal.heading).toBe("Jadwal kelas");
    expect(filled.layanan.heading).toBe(PAGE_HEADER_DEFAULTS.layanan.heading);
  });

  it("teks /pelatihan: field kosong = bawaan, decor tetap nilai tersimpan", () => {
    const stored: TrainingsPage = {
      featured: { eyebrow: "", heading: "Favorit", lead: "" },
      all: { eyebrow: "", heading: "" },
      cta: { ...TRAININGS_PAGE_DEFAULTS.cta, heading: "", primaryLabel: "", primaryHref: "", decor: false },
    };
    const filled = withTrainingsPageDefaults(stored);
    expect(filled.featured).toEqual({ ...TRAININGS_PAGE_DEFAULTS.featured, heading: "Favorit" });
    expect(filled.all).toEqual(TRAININGS_PAGE_DEFAULTS.all);
    expect(filled.cta.heading).toBe(TRAININGS_PAGE_DEFAULTS.cta.heading);
    expect(filled.cta.primaryHref).toBe("/kontak");
    expect(filled.cta.decor).toBe(false);
  });

  it("BE versi lama tanpa halaman/objek: teks bawaan, tidak error", () => {
    expect(withPageHeaderDefaults("artikel", undefined)).toEqual(PAGE_HEADER_DEFAULTS.artikel);
    expect(withTrainingsPageDefaults(undefined)).toEqual(TRAININGS_PAGE_DEFAULTS);
  });
});
