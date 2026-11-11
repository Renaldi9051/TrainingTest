import type { PageHeader, PageHeaderPage, TrainingsPage } from "@/lib/api/types";

// Teks bawaan halaman publik untuk setting page.headers dan trainings.page. Satu sumber untuk dua
// pemakai: halaman publik (dipakai per field kalau setting kosong) dan form Pengaturan admin (kolom
// langsung berisi teks yang sedang tampil, bukan kosong). Lead kosong = halaman tanpa pengantar
// (kontak: tagline situs).
export const PAGE_HEADER_DEFAULTS: Record<PageHeaderPage, PageHeader> = {
  pelatihan: {
    eyebrow: "",
    heading: "Pelatihan untuk setiap *bidang* kerja",
    lead: "Public dan in-house. Pilih kategori untuk melihat daftar judul dan target pesertanya.",
  },
  layanan: { eyebrow: "", heading: "Layanan", lead: "" },
  portofolio: { eyebrow: "", heading: "Portofolio", lead: "" },
  jadwal: { eyebrow: "", heading: "Jadwal pelatihan", lead: "" },
  kontak: { eyebrow: "", heading: "Hubungi kami", lead: "" },
  artikel: {
    eyebrow: "",
    heading: "Berita & artikel",
    lead: "Kabar terbaru, regulasi, dan wawasan seputar pelatihan dan teknologi.",
  },
};

export const TRAININGS_PAGE_DEFAULTS: TrainingsPage = {
  featured: {
    eyebrow: "Paling dicari",
    heading: "Kategori unggulan",
    lead: "Bidang pilihan untuk instansi dan perusahaan.",
  },
  all: { eyebrow: "Semua kategori", heading: "Kategori A-Z" },
  cta: {
    eyebrow: "Pelatihan in-house",
    heading: "Tidak menemukan topik yang dicari?",
    lead: "Ceritakan kebutuhan tim Anda. Materi, jadwal, dan lokasi bisa disesuaikan.",
    primaryLabel: "Request pelatihan in-house",
    primaryHref: "/kontak",
    secondaryLabel: "Lihat jadwal",
    secondaryHref: "/jadwal",
    outline: "IN-HOUSE",
    decor: true,
  },
};

// Field teks yang kosong diganti teks bawaan; field lain (mis. decor) tetap nilai tersimpan. Toleran
// terhadap objek/field yang tidak ada (BE versi lama belum mengirim halaman baru, mis. artikel).
function fillEmpty<T extends Record<string, unknown>>(value: T | undefined, defaults: T): T {
  const result = { ...defaults, ...value };
  for (const key of Object.keys(defaults) as (keyof T)[]) {
    const current = value?.[key];
    if (current === undefined || (typeof current === "string" && current.trim() === "")) result[key] = defaults[key];
  }
  return result;
}

export function withPageHeaderDefaults(page: PageHeaderPage, header: PageHeader | undefined): PageHeader {
  return fillEmpty(header, PAGE_HEADER_DEFAULTS[page]);
}

export function withPageHeadersDefaults(headers: Record<PageHeaderPage, PageHeader>): Record<PageHeaderPage, PageHeader> {
  const pages = Object.keys(PAGE_HEADER_DEFAULTS) as PageHeaderPage[];
  return Object.fromEntries(
    pages.map((page) => [page, withPageHeaderDefaults(page, headers[page])]),
  ) as Record<PageHeaderPage, PageHeader>;
}

export function withTrainingsPageDefaults(texts: TrainingsPage | undefined): TrainingsPage {
  return {
    featured: fillEmpty(texts?.featured, TRAININGS_PAGE_DEFAULTS.featured),
    all: fillEmpty(texts?.all, TRAININGS_PAGE_DEFAULTS.all),
    cta: fillEmpty(texts?.cta, TRAININGS_PAGE_DEFAULTS.cta),
  };
}
