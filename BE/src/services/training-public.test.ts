import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockDb, type MockDb } from "@/test/mock-db";

const db = vi.hoisted(() => ({ current: undefined as unknown }));
vi.mock("@/lib/db", () => ({ getDb: () => db.current }));

import {
  computeInvestment,
  getPublicTraining,
  listPublicTrainings,
  nextOpenSchedule,
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
  priceText: "Rp4.500.000",
  showPrice: false,
  cover: null,
  seo: null,
  status: "PUBLISHED",
  publishedAt: new Date("2026-10-01T00:00:00Z"),
  createdAt: now,
  updatedAt: now,
  categories: [{ categoryId: "c1", category: { slug: "sdm", name: "SDM", order: 0, deletedAt: null } }],
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

  it("fasilitas khusus pelatihan menggantikan default", async () => {
    mock.training.findFirst.mockResolvedValue(detailRow({ facilities: ["Makan siang"] }));
    expect((await getPublicTraining("kpi", now))?.facilities).toEqual(["Makan siang"]);
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
