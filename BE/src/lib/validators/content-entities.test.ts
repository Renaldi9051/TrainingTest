import { describe, expect, it } from "vitest";
import { clientCreateSchema, clientUpdateSchema } from "@/lib/validators/client";
import { marketingCreateSchema, marketingListQuerySchema } from "@/lib/validators/marketing";
import { mediaPartnerCreateSchema } from "@/lib/validators/media-partner";
import { portfolioCreateSchema, portfolioUpdateSchema, PORTFOLIO_IMAGES_MAX } from "@/lib/validators/portfolio";
import {
  readServiceBenefits,
  readServiceFaqs,
  readServiceTrainingSelection,
  serviceCreateSchema,
  serviceListQuerySchema,
  serviceUpdateSchema,
} from "@/lib/validators/service";
import { QUOTE_MAX, testimonialCreateSchema } from "@/lib/validators/testimonial";

const id = (n: number) => `0199b4d0-0000-7000-8000-${String(n).padStart(12, "0")}`;

describe("service", () => {
  it("default draft, tanpa ikon/gambar/isi", () => {
    expect(serviceCreateSchema.parse({ title: "In-house training" })).toEqual({
      title: "In-house training",
      slug: undefined,
      tagline: null,
      icon: null,
      summary: null,
      body: null,
      imageId: null,
      benefits: [],
      faqs: [],
      trainingSelection: null,
      status: "DRAFT",
      seo: { title: "", description: "", ogImageId: null },
    });
  });

  it("tagline, benefit, FAQ, pelatihan terkait (manual, maks 12, unik)", () => {
    const ID = (n: number) => `0199b4d0-0000-7000-8000-${String(n).padStart(12, "0")}`;
    const parsed = serviceCreateSchema.parse({
      title: "x",
      tagline: "  Kelas khusus instansi ",
      benefits: [{ title: "Materi disesuaikan" }],
      faqs: [{ q: "Minimal peserta?", a: "10 orang." }],
      trainingSelection: { mode: "manual", ids: [ID(1), ID(2)] },
    });
    expect(parsed).toMatchObject({
      tagline: "Kelas khusus instansi",
      benefits: [{ icon: null, title: "Materi disesuaikan", description: "" }],
      trainingSelection: { mode: "manual", ids: [ID(1), ID(2)] },
    });
    expect(serviceCreateSchema.safeParse({ title: "x", tagline: "a".repeat(121) }).success).toBe(false);
    expect(serviceCreateSchema.safeParse({ title: "x", benefits: [{ title: "" }] }).success).toBe(false);
    expect(serviceCreateSchema.safeParse({ title: "x", faqs: [{ q: "Tanya?", a: " " }] }).success).toBe(false);
    const ids = (count: number) => Array.from({ length: count }, (_, index) => ID(index + 1));
    expect(serviceCreateSchema.safeParse({ title: "x", trainingSelection: { mode: "manual", ids: ids(12) } }).success).toBe(true);
    expect(serviceCreateSchema.safeParse({ title: "x", trainingSelection: { mode: "manual", ids: ids(13) } }).success).toBe(false);
    expect(serviceCreateSchema.safeParse({ title: "x", trainingSelection: { mode: "manual", ids: [] } }).success).toBe(false);
    expect(serviceCreateSchema.safeParse({ title: "x", trainingSelection: { mode: "manual", ids: [ID(1), ID(1)] } }).success).toBe(false);
    // Mode kategori belum dibuat (keputusan pemilik): ditolak.
    expect(serviceCreateSchema.safeParse({ title: "x", trainingSelection: { mode: "categories", ids: [ID(1)] } }).success).toBe(false);
    // Update tanpa field baru: nilai lama tidak disentuh (undefined), null = hapus pilihan.
    const update = serviceUpdateSchema.parse({ title: "Baru" });
    expect([update.tagline, update.benefits, update.faqs, update.trainingSelection]).toEqual([undefined, undefined, undefined, undefined]);
    expect(serviceUpdateSchema.parse({ trainingSelection: null }).trainingSelection).toBeNull();
  });

  it("data JSON lama/rusak dibaca kosong, bukan error", () => {
    expect(readServiceBenefits([])).toEqual([]);
    expect(readServiceBenefits([{ broken: true }])).toEqual([]);
    expect(readServiceFaqs(null)).toEqual([]);
    expect(readServiceTrainingSelection(null)).toBeNull();
    expect(readServiceTrainingSelection({ mode: "auto" })).toBeNull();
  });

  it("ikon harus dari daftar ikon kategori", () => {
    expect(serviceCreateSchema.safeParse({ title: "x", icon: "users" }).success).toBe(true);
    expect(serviceCreateSchema.safeParse({ title: "x", icon: "<svg>" }).success).toBe(false);
  });

  it("isi rich text kosong disimpan null, link javascript: ditolak", () => {
    expect(serviceCreateSchema.parse({ title: "x", body: { type: "doc", content: [] } }).body).toBeNull();
    const bad = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "x", marks: [{ type: "link", attrs: { href: "javascript:x" } }] }] },
      ],
    };
    expect(serviceCreateSchema.safeParse({ title: "x", body: bad }).success).toBe(false);
  });

  it("update kosong ditolak; list default urut order", () => {
    expect(serviceUpdateSchema.safeParse({}).success).toBe(false);
    expect(serviceListQuerySchema.parse({}).sort).toEqual({ field: "order", direction: "asc" });
  });
});

describe("client", () => {
  it("url kosong jadi null, javascript: ditolak", () => {
    expect(clientCreateSchema.parse({ name: "PT Contoh", url: "" })).toEqual({
      name: "PT Contoh",
      logoId: null,
      url: null,
    });
    expect(clientCreateSchema.safeParse({ name: "x", url: "javascript:alert(1)" }).success).toBe(false);
  });

  it("update kosong ditolak", () => {
    expect(clientUpdateSchema.safeParse({}).success).toBe(false);
  });
});

describe("testimonial", () => {
  it(`kutipan wajib, maks ${QUOTE_MAX} karakter`, () => {
    expect(testimonialCreateSchema.safeParse({ name: "Budi" }).success).toBe(false);
    expect(testimonialCreateSchema.safeParse({ name: "Budi", quote: "x".repeat(QUOTE_MAX + 1) }).success).toBe(false);
    expect(testimonialCreateSchema.parse({ name: "Budi", quote: "Materinya aplikatif." })).toMatchObject({
      role: null,
      company: null,
      photoId: null,
    });
  });
});

describe("portfolio", () => {
  it("jenis kegiatan: 4 nilai atau null; update tanpa field = tidak disentuh", () => {
    expect(portfolioCreateSchema.parse({ title: "x" }).activityType).toBeNull();
    expect(portfolioCreateSchema.parse({ title: "x", activityType: "FIELD" }).activityType).toBe("FIELD");
    expect(portfolioCreateSchema.safeParse({ title: "x", activityType: "lapangan" }).success).toBe(false);
    expect(portfolioUpdateSchema.parse({ title: "y" }).activityType).toBeUndefined();
    expect(portfolioUpdateSchema.parse({ activityType: null }).activityType).toBeNull();
  });

  it("tanggal YYYY-MM-DD yang benar-benar ada", () => {
    expect(portfolioCreateSchema.safeParse({ title: "x", date: "2026-02-31" }).success).toBe(false);
    expect(portfolioCreateSchema.parse({ title: "x", date: "2026-03-01" }).date).toBe("2026-03-01");
  });

  it("galeri: id unik, urutan dipertahankan, ada batas", () => {
    expect(portfolioCreateSchema.parse({ title: "x", imageIds: [id(2), id(1)] }).imageIds).toEqual([id(2), id(1)]);
    expect(portfolioCreateSchema.safeParse({ title: "x", imageIds: [id(1), id(1)] }).success).toBe(false);
    const tooMany = Array.from({ length: PORTFOLIO_IMAGES_MAX + 1 }, (_, index) => id(index + 1));
    expect(portfolioUpdateSchema.safeParse({ imageIds: tooMany }).success).toBe(false);
  });
});

describe("marketing", () => {
  it("nomor WhatsApp wajib dan dinormalkan", () => {
    expect(marketingCreateSchema.safeParse({ name: "Sari" }).success).toBe(false);
    expect(marketingCreateSchema.parse({ name: "Sari", phone: "0812 3456 7890" })).toEqual({
      name: "Sari",
      area: null,
      phone: "6281234567890",
      photoId: null,
      defaultMessage: null,
      active: true,
    });
  });

  it("area opsional, maks 60 karakter, kosong = null", () => {
    expect(marketingCreateSchema.parse({ name: "Sari", phone: "0812 3456 7890", area: " Instansi pemerintah " }).area).toBe("Instansi pemerintah");
    expect(marketingCreateSchema.parse({ name: "Sari", phone: "0812 3456 7890", area: "" }).area).toBeNull();
    expect(marketingCreateSchema.safeParse({ name: "Sari", phone: "0812 3456 7890", area: "a".repeat(61) }).success).toBe(false);
  });

  it("filter active dari query string", () => {
    expect(marketingListQuerySchema.parse({ active: "false" }).active).toBe(false);
    expect(marketingListQuerySchema.parse({}).active).toBeUndefined();
  });
});

describe("media partner", () => {
  it("nama wajib, url opsional", () => {
    expect(mediaPartnerCreateSchema.safeParse({ url: "https://x.example" }).success).toBe(false);
    expect(mediaPartnerCreateSchema.parse({ name: "Majalah HR" })).toEqual({ name: "Majalah HR", url: null });
  });
});
