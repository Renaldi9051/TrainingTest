import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockDb, type MockDb } from "@/test/mock-db";

const db = vi.hoisted(() => ({ current: undefined as unknown }));
vi.mock("@/lib/db", () => ({ getDb: () => db.current }));

import {
  computeInvestment,
  getPublicTraining,
  listPublicTrainings,
  nextOpenSchedule,
  resolveCover,
} from "@/services/training-public";
import { publicTrainingQuerySchema } from "@/lib/validators/training";

const now = new Date("2026-10-10T05:00:00.000Z");

const detailRow = (extra: Record<string, unknown> = {}) => ({
  id: "t1",
  slug: "kpi",
  title: "KPI",
  summary: "Ringkas",
  description: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Isi" }] }] },
  outcomes: ["A", "B", "C", "D"],
  modules: [{ title: "Modul 1", points: ["Poin"], durationMinutes: 90 }],
  audience: [{ role: "Supervisor", note: null }],
  prerequisites: null,
  facilities: null,
  faq: [{ q: "Khusus?", a: "Ya." }],
  duration: "2 hari",
  method: "OFFLINE",
  types: ["PUBLIC"],
  level: null,
  certificate: null,
  priceText: "Rp4.500.000",
  showPrice: false,
  cover: null,
  seo: null,
  status: "PUBLISHED",
  publishedAt: new Date("2026-10-01T00:00:00Z"),
  createdAt: now,
  updatedAt: now,
  categories: [{ categoryId: "c1", category: { slug: "sdm", name: "SDM", order: 0, deletedAt: null } }],
  images: [],
  schedules: [
    {
      id: "s1",
      startDate: new Date("2026-10-08T00:00:00Z"),
      endDate: new Date("2026-10-09T00:00:00Z"),
      city: "Jakarta",
      venue: null,
      method: "OFFLINE",
      price: 4500000,
      status: "OPEN",
    },
    {
      id: "s2",
      startDate: new Date("2026-11-17T00:00:00Z"),
      endDate: new Date("2026-11-18T00:00:00Z"),
      city: "Bandung",
      venue: null,
      method: "OFFLINE",
      price: 4500000,
      status: "FULL",
    },
  ],
  ...extra,
});

let mock: MockDb;
beforeEach(() => {
  mock = createMockDb();
  db.current = mock;
  mock.media.findMany.mockResolvedValue([]);
  mock.training.findMany.mockResolvedValue([]);
  mock.siteSetting.findUnique.mockResolvedValue({
    key: "training.defaults",
    value: {
      facilities: ["Sertifikat", "Modul digital"],
      faq: [{ q: "Global?", a: "Ya." }],
      inHouseNote: "Bisa in-house.",
      disclaimer: "",
    },
  });
});

describe("getPublicTraining", () => {
  it("query memakai aturan tampil publik (draft & terjadwal tidak ikut)", async () => {
    mock.training.findFirst.mockResolvedValue(null);
    expect(await getPublicTraining("kpi", now)).toBeNull();
    expect(mock.training.findFirst.mock.calls[0][0].where).toEqual({
      slug: "kpi",
      deletedAt: null,
      status: "PUBLISHED",
      publishedAt: { lte: now },
    });
  });

  it("showPrice false: harga pelatihan & harga per sesi tidak dikirim", async () => {
    mock.training.findFirst.mockResolvedValue(detailRow());
    const detail = await getPublicTraining("kpi", now);
    expect(detail?.priceText).toBeNull();
    expect(detail?.schedules.map((schedule) => schedule.price)).toEqual([null, null]);
  });

  it("showPrice true: harga dikirim", async () => {
    mock.training.findFirst.mockResolvedValue(detailRow({ showPrice: true }));
    const detail = await getPublicTraining("kpi", now);
    expect(detail?.priceText).toBe("Rp4.500.000");
    expect(detail?.schedules[1].price).toBe(4500000);
  });

  it("deskripsi dirender ke HTML; sesi yang lewat tampil SELESAI", async () => {
    mock.training.findFirst.mockResolvedValue(detailRow());
    const detail = await getPublicTraining("kpi", now);
    expect(detail?.descriptionHtml).toBe("<p>Isi</p>");
    expect(detail?.schedules.map((schedule) => schedule.status)).toEqual(["COMPLETED", "FULL"]);
  });

  it("fasilitas null memakai default global; FAQ pelatihan tampil sebelum FAQ global", async () => {
    mock.training.findFirst.mockResolvedValue(detailRow());
    const detail = await getPublicTraining("kpi", now);
    expect(detail?.facilities).toEqual(["Sertifikat", "Modul digital"]);
    expect(detail?.faq.map((item) => item.q)).toEqual(["Khusus?", "Global?"]);
    expect(detail?.inHouseNote).toBe("Bisa in-house.");
    expect(detail?.disclaimer).toBeNull();
  });

  it("tingkat, sertifikat, dan hari modul: null kalau belum diisi; terkirim kalau diisi", async () => {
    mock.training.findFirst.mockResolvedValue(detailRow());
    const empty = await getPublicTraining("kpi", now);
    expect(empty).toMatchObject({ level: null, certificate: null });
    expect(empty?.modules).toEqual([{ title: "Modul 1", points: ["Poin"], durationMinutes: 90, day: null }]);

    mock.training.findFirst.mockResolvedValue(
      detailRow({ level: "ADVANCED", certificate: false, modules: [{ title: "Hari pertama", points: [], day: 1 }] }),
    );
    const filled = await getPublicTraining("kpi", now);
    expect(filled).toMatchObject({ level: "ADVANCED", certificate: false });
    expect(filled?.modules[0].day).toBe(1);
  });

  it("fasilitas khusus pelatihan menggantikan default", async () => {
    mock.training.findFirst.mockResolvedValue(detailRow({ facilities: ["Makan siang"] }));
    expect((await getPublicTraining("kpi", now))?.facilities).toEqual(["Makan siang"]);
  });

  it("galeri: urutan admin, gambar di Sampah dilewati, terpisah dari sampul", async () => {
    const media = (id: string, deletedAt: Date | null = null) => ({
      id,
      path: `2026/10/${id}.webp`,
      originalName: `${id}.jpg`,
      mime: "image/webp",
      size: 100,
      width: 1600,
      height: 1200,
      alt: `Alt ${id}`,
      folder: null,
      variants: null,
      createdAt: now,
      updatedAt: now,
      deletedAt,
      updatedById: null,
    });
    mock.training.findFirst.mockResolvedValue(
      detailRow({
        cover: media("sampul"),
        images: [
          { mediaId: "g1", order: 0, media: media("g1") },
          { mediaId: "g2", order: 1, media: media("g2", now) },
          { mediaId: "g3", order: 2, media: media("g3") },
        ],
      }),
    );
    const detail = await getPublicTraining("kpi", now);
    expect(detail?.images.map((image) => image.alt)).toEqual(["Alt g1", "Alt g3"]);
    expect(detail?.cover?.alt).toBe("Alt sampul");
    expect(mock.training.findFirst.mock.calls[0][0].include.images).toEqual({
      orderBy: { order: "asc" },
      include: { media: true },
    });
  });
});

describe("listPublicTrainings", () => {
  it("search dikirim sebagai parameter (bukan disambung ke SQL) dan urutan hasil dipertahankan", async () => {
    mock.$transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        $executeRaw: vi.fn(),
        $queryRaw: vi.fn(async () => [
          { id: "b", total: BigInt(2) },
          { id: "a", total: BigInt(2) },
        ]),
      }),
    );
    mock.training.findMany.mockResolvedValue([
      { ...detailRow({ id: "a", slug: "a", title: "A" }) },
      { ...detailRow({ id: "b", slug: "b", title: "B" }) },
    ]);
    const result = await listPublicTrainings(publicTrainingQuerySchema.parse({ q: "kpi'; DROP TABLE x;--" }), now);
    expect(result.items.map((item) => item.slug)).toEqual(["b", "a"]);
    expect(result.meta).toMatchObject({ total: 2, page: 1, pageSize: 24, totalPages: 1 });
  });
});

describe("investasi & jadwal terdekat", () => {
  const open = (price: number | null) => ({ price, status: "OPEN" as const });

  it("showPrice mati: selalu null (Hubungi marketing)", () => {
    expect(computeInvestment(false, "Rp1", [open(100)])).toBeNull();
  });

  it("harga sesi DIBUKA termurah dipakai dulu", () => {
    expect(computeInvestment(true, "Rp9", [open(300), { price: 100, status: "FULL" }, open(200)])).toEqual({
      type: "from",
      amount: 200,
    });
  });

  it("belum ada sesi berharga: pakai priceText, kalau kosong null", () => {
    expect(computeInvestment(true, "Rp4.500.000 per peserta", [])).toEqual({ type: "text", text: "Rp4.500.000 per peserta" });
    expect(computeInvestment(true, null, [open(null)])).toBeNull();
  });

  it("jadwal terdekat = sesi DIBUKA pertama; tidak ada = null", () => {
    const base = { id: "s", endDate: "2026-11-02", city: "Jakarta", venue: null, method: "OFFLINE" as const, price: null };
    expect(
      nextOpenSchedule([
        { ...base, startDate: "2026-10-20", status: "FULL" },
        { ...base, startDate: "2026-11-01", status: "OPEN" },
      ]),
    ).toEqual({ startDate: "2026-11-01", endDate: "2026-11-02", city: "Jakarta", method: "OFFLINE" });
    expect(nextOpenSchedule([{ ...base, startDate: "2026-10-20", status: "FULL" }])).toBeNull();
  });
});

// Sampul pelatihan -> gambar kategori aktif pertama (urutan admin) -> null.
describe("gambar pelatihan: urutan fallback", () => {
  const image = (id: string, extra: Record<string, unknown> = {}) => ({
    id,
    path: `2026/10/${id}.webp`,
    originalName: `${id}.jpg`,
    mime: "image/webp",
    size: 100,
    width: 1600,
    height: 1200,
    alt: `Alt ${id}`,
    folder: null,
    variants: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    updatedById: null,
    ...extra,
  });
  const cat = (order: number, img: ReturnType<typeof image> | null, deletedAt: Date | null = null) => ({
    order,
    deletedAt,
    image: img,
  });

  it("sampul pelatihan menang atas gambar kategori", () => {
    expect(resolveCover(image("sampul"), [cat(0, image("kategori"))])).toEqual({
      cover: expect.objectContaining({ alt: "Alt sampul", url: expect.stringContaining("sampul.webp") }),
      coverSource: "training",
    });
  });

  it("sampul kosong: kategori pertama menurut urutan admin yang punya gambar; alt dari media kategori", () => {
    const result = resolveCover(null, [cat(5, image("kelima")), cat(0, null), cat(2, image("kedua"))]);
    expect(result.coverSource).toBe("category");
    expect(result.cover).toMatchObject({ alt: "Alt kedua", url: expect.stringContaining("kedua.webp") });
  });

  it("sampul dan gambar kategori di Sampah, serta kategori di Sampah, dilewati", () => {
    const result = resolveCover(image("sampul", { deletedAt: now }), [
      cat(0, image("kategori-terhapus"), now),
      cat(1, image("media-terhapus", { deletedAt: now })),
      cat(2, image("aktif")),
    ]);
    expect(result).toMatchObject({ coverSource: "category", cover: { alt: "Alt aktif" } });
  });

  it("tanpa sampul dan tanpa gambar kategori: null (blok tanpa sampul di FE)", () => {
    expect(resolveCover(null, [cat(0, null), cat(1, image("x"), now)])).toEqual({ cover: null, coverSource: null });
    expect(resolveCover(null, [])).toEqual({ cover: null, coverSource: null });
  });

  it("detail: gambar kategori dipakai sebagai sampul dan gambar OG; query memuat gambar kategori", async () => {
    mock.training.findFirst.mockResolvedValue(
      detailRow({
        categories: [
          { categoryId: "c1", category: { slug: "sdm", name: "SDM", order: 0, deletedAt: null, image: image("sdm") } },
        ],
      }),
    );
    const detail = await getPublicTraining("kpi", now);
    expect(detail).toMatchObject({ coverSource: "category", cover: { alt: "Alt sdm" } });
    expect(detail?.seo.ogImage).toMatchObject({ alt: "Alt sdm" });
    const include = mock.training.findFirst.mock.calls[0][0].include;
    expect(include.categories.include.category.select.image).toBe(true);
  });

  it("detail tanpa sampul dan tanpa gambar kategori: cover null, coverSource null", async () => {
    mock.training.findFirst.mockResolvedValue(detailRow());
    expect(await getPublicTraining("kpi", now)).toMatchObject({ cover: null, coverSource: null });
  });
});
