import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HomeSectionType, Prisma } from "@/generated/prisma/client";
import { createMockDb, passThroughTransactions, type MockDb } from "@/test/mock-db";

const db = vi.hoisted(() => ({ current: undefined as unknown }));
vi.mock("@/lib/db", () => ({ getDb: () => db.current }));
const revalidate = vi.hoisted(() => vi.fn(async () => true));
vi.mock("@/lib/revalidate", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/revalidate")>()),
  revalidateTags: revalidate,
}));

import { homeSectionCreateSchema } from "@/lib/validators/home-section";
import {
  createHomeSection,
  getHomePreview,
  getPublicHome,
  resolveHomeSections,
  restoreHomeSection,
  updateHomeSection,
} from "@/services/home-section";

const now = new Date("2026-10-12T05:00:00Z");
const uuid = (n: number) => `0199b4d0-0000-7000-8000-${String(n).padStart(12, "0")}`;
const ID = uuid(1);
const MEDIA = uuid(900);

let seq = 0;
const section = (type: HomeSectionType, content: Prisma.JsonObject, extra: Record<string, unknown> = {}) => ({
  id: uuid(100 + ++seq),
  type,
  title: null,
  content,
  order: seq,
  visible: true,
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
  updatedById: null,
  ...extra,
});

const p2002 = Object.assign(new Error("unique"), { code: "P2002" });

let mock: MockDb;

beforeEach(() => {
  mock = createMockDb();
  db.current = mock;
  passThroughTransactions(mock);
  revalidate.mockClear();
  seq = 0;
  for (const model of [mock.service, mock.client, mock.testimonial, mock.training, mock.schedule, mock.category, mock.media]) {
    model.findMany.mockResolvedValue([]);
  }
  mock.homeSection.aggregate.mockResolvedValue({ _max: { order: 3 } });
});

describe("HERO/CTA maksimal satu", () => {
  it("buat HERO saat sudah ada: 409 dengan pesan Bahasa Indonesia", async () => {
    mock.homeSection.count.mockResolvedValue(1);
    await expect(
      createHomeSection(homeSectionCreateSchema.parse({ type: "HERO", content: { headline: "Halo" } }), "u1"),
    ).rejects.toMatchObject({
      status: 409,
      code: "SECTION_EXISTS",
      message: "Section Hero sudah ada. Beranda hanya boleh punya satu Hero.",
    });
    expect(mock.homeSection.create).not.toHaveBeenCalled();
  });

  it("balapan ditangkap unique index (P2002) jadi 409 yang sama", async () => {
    mock.homeSection.count.mockResolvedValue(0);
    mock.homeSection.create.mockRejectedValue(p2002);
    await expect(
      createHomeSection(homeSectionCreateSchema.parse({ type: "CTA", content: { heading: "x", primaryCta: { label: "Hubungi", href: "/kontak" } } }), "u1"),
    ).rejects.toMatchObject({ status: 409, code: "SECTION_EXISTS" });
  });

  it("type lain boleh lebih dari satu (tidak dicek)", async () => {
    mock.homeSection.create.mockImplementation(async ({ data }) => section("STATS", data.content as Prisma.JsonObject));
    await createHomeSection(
      homeSectionCreateSchema.parse({ type: "STATS", content: { items: [{ value: 1, label: "x" }] } }),
      "u1",
    );
    expect(mock.homeSection.count).not.toHaveBeenCalled();
    expect(mock.homeSection.create.mock.calls[0][0].data.order).toBe(4);
    expect(revalidate).toHaveBeenCalledWith(["home"]);
  });

  it("pulihkan HERO yang bentrok dengan HERO aktif: 409", async () => {
    mock.homeSection.findFirst.mockResolvedValue(section("HERO", { headline: "Lama" }, { id: ID, deletedAt: now }));
    mock.homeSection.count.mockResolvedValue(1);
    await expect(restoreHomeSection(ID, "u1")).rejects.toMatchObject({
      status: 409,
      code: "SECTION_EXISTS",
      message: "Section Hero yang aktif sudah ada. Hapus section Hero itu dulu sebelum memulihkan yang ini.",
    });
    expect(mock.homeSection.count.mock.calls[0][0].where).toEqual({ type: "HERO", deletedAt: null, id: { not: ID } });
    expect(mock.homeSection.update).not.toHaveBeenCalled();
  });

  it("pulihkan: P2002 dari balapan juga jadi 409", async () => {
    mock.homeSection.findFirst.mockResolvedValue(section("CTA", {}, { id: ID, deletedAt: now }));
    mock.homeSection.count.mockResolvedValue(0);
    mock.homeSection.update.mockRejectedValue(p2002);
    await expect(restoreHomeSection(ID, "u1")).rejects.toMatchObject({ status: 409, code: "SECTION_EXISTS" });
  });
});

describe("updateHomeSection", () => {
  it("isi divalidasi terhadap type tersimpan; error dengan path content.items.N.field", async () => {
    mock.homeSection.findFirst.mockResolvedValue(section("STATS", { items: [{ value: 1, label: "x" }] }, { id: ID }));
    await expect(
      updateHomeSection(ID, { content: { items: [{ value: 1, label: "ok" }, { value: -5, label: "" }] } }, "u1"),
    ).rejects.toMatchObject({
      status: 422,
      fields: {
        "content.items.1.value": ["Angka tidak boleh negatif."],
        "content.items.1.label": ["Label wajib diisi."],
      },
    });
  });

  it("gambar hero wajib alt: error di content.image", async () => {
    mock.homeSection.findFirst.mockResolvedValue(section("HERO", { headline: "x" }, { id: ID }));
    mock.media.findMany.mockResolvedValue([{ id: MEDIA, mime: "image/webp", alt: "" }]);
    await expect(
      updateHomeSection(ID, { content: { headline: "x", image: { mediaId: MEDIA } } }, "u1"),
    ).rejects.toMatchObject({
      status: 422,
      fields: { "content.image": ["Gambar belum punya teks alt. Isi alt di media library dulu."] },
    });
  });

  it("toggle visible saja tidak memvalidasi isi; revalidate home", async () => {
    mock.homeSection.findFirst.mockResolvedValue(section("CLIENTS", { mode: "auto" }, { id: ID }));
    mock.homeSection.update.mockImplementation(async ({ data }) => section("CLIENTS", { mode: "auto" }, { id: ID, ...data }));
    const updated = await updateHomeSection(ID, { visible: false }, "u1");
    expect(updated.visible).toBe(false);
    expect(mock.homeSection.update.mock.calls[0][0].data).toEqual({ updatedById: "u1", visible: false });
    expect(revalidate).toHaveBeenCalledWith(["home"]);
  });
});

// Penghitung panggilan delegate: jumlah query per entitas tetap, berapa pun jumlah section.
function queryCounts() {
  return {
    service: mock.service.findMany.mock.calls.length,
    category: mock.category.findMany.mock.calls.length,
    training: mock.training.findMany.mock.calls.length,
    schedule: mock.schedule.findMany.mock.calls.length,
    client: mock.client.findMany.mock.calls.length,
    testimonial: mock.testimonial.findMany.mock.calls.length,
    media: mock.media.findMany.mock.calls.length,
  };
}

function manySections(copies: number) {
  return Array.from({ length: copies }, () => [
    section("HERO", { headline: "x", image: { mediaId: MEDIA } }),
    section("SERVICES", { mode: "manual", ids: [uuid(1)] }),
    section("SERVICES", { mode: "auto", limit: 3 }),
    section("CATEGORIES", { mode: "auto", limit: 8 }),
    section("CATEGORIES", { mode: "manual", ids: [uuid(2)] }),
    section("LATEST_TRAININGS", { mode: "auto", limit: 6 }),
    section("LATEST_TRAININGS", { mode: "manual", ids: [uuid(3), uuid(4)] }),
    section("UPCOMING_SCHEDULES", { limit: 5 }),
    section("UPCOMING_SCHEDULES", { limit: 3 }),
    section("CLIENTS", { mode: "auto", limit: 24 }),
    section("CLIENTS", { mode: "manual", ids: [uuid(5)] }),
    section("TESTIMONIALS", { mode: "manual", ids: [uuid(6)] }),
    section("TESTIMONIALS", { mode: "auto", limit: 6 }),
  ]).flat();
}

describe("resolveHomeSections: jumlah query", () => {
  it("per entitas maksimal 1 query id manual + 1 query auto; jadwal & media 1 query; tidak bertambah saat section dilipatgandakan", async () => {
    await resolveHomeSections(manySections(1), now);
    const once = queryCounts();
    expect(once).toEqual({ service: 2, category: 2, training: 2, schedule: 1, client: 2, testimonial: 2, media: 1 });

    for (const model of [mock.service, mock.client, mock.testimonial, mock.training, mock.schedule, mock.category, mock.media]) {
      model.findMany.mockClear();
    }
    await resolveHomeSections(manySections(5), now);
    expect(queryCounts()).toEqual(once);
  });

  it("id manual dari semua section diambil dalam satu query; auto memakai limit terbesar", async () => {
    await resolveHomeSections(
      [
        section("CLIENTS", { mode: "manual", ids: [uuid(5), uuid(6)] }),
        section("CLIENTS", { mode: "manual", ids: [uuid(6), uuid(7)] }),
        section("CLIENTS", { mode: "auto", limit: 4 }),
        section("CLIENTS", { mode: "auto", limit: 30 }),
      ],
      now,
    );
    const [manualCall, autoCall] = [...mock.client.findMany.mock.calls].sort((a) => (a[0].where.id ? -1 : 1));
    expect(manualCall[0].where).toEqual({ id: { in: [uuid(5), uuid(6), uuid(7)] }, deletedAt: null });
    expect(autoCall[0].take).toBe(30);
  });

  it("tanpa section berbasis data: tidak ada query data", async () => {
    await resolveHomeSections([section("STATS", { items: [{ value: 1, label: "x" }] }), section("VISION_MISSION", { vision: "v", mission: ["m"] })], now);
    expect(queryCounts()).toEqual({ service: 0, category: 0, training: 0, schedule: 0, client: 0, testimonial: 0, media: 0 });
  });
});

describe("resolveHomeSections: isi", () => {
  it("manual: urutan admin dijaga, id yang dihapus/draft (tidak dikembalikan query publik) tersaring", async () => {
    const client = (id: string, name: string) => ({
      id,
      name,
      url: null,
      logoId: null,
      logo: null,
      order: 0,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      updatedById: null,
    });
    mock.client.findMany.mockResolvedValue([client(uuid(7), "C"), client(uuid(5), "A")]);
    const [resolved] = await resolveHomeSections([section("CLIENTS", { mode: "manual", ids: [uuid(5), uuid(6), uuid(7)] })], now);
    expect(resolved).toMatchObject({ type: "CLIENTS", empty: false, items: [{ name: "A" }, { name: "C" }] });
    expect(resolved).not.toHaveProperty("ids");
    expect(resolved).not.toHaveProperty("mode");
  });

  it("kategori auto: unggulan + punya pelatihan publik, dihitung di query", async () => {
    await resolveHomeSections([section("CATEGORIES", { mode: "auto", limit: 8 })], now);
    const where = mock.category.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({ deletedAt: null, featured: true });
    expect(where.trainings).toEqual({
      some: { training: { deletedAt: null, status: "PUBLISHED", publishedAt: { lte: now } } },
    });
  });

  it("isi tersimpan yang rusak dilewati", async () => {
    const result = await resolveHomeSections([section("CTA", { heading: 1 }), section("STATS", { items: [{ value: 2, label: "y" }] })], now);
    expect(result.map((item) => item.type)).toEqual(["STATS"]);
  });
});

describe("jadwal terdekat: batas hari WIB", () => {
  it.each([
    // 23:59:59 WIB 12 Okt: hari ini masih 12 Okt.
    ["2026-10-12T16:59:59.000Z", "2026-10-12"],
    // 00:00:00 WIB 13 Okt (17:00 UTC 12 Okt): hari ini sudah 13 Okt, sesi yang berakhir 12 Okt tidak ikut.
    ["2026-10-12T17:00:00.000Z", "2026-10-13"],
  ])("now %s -> hari ini %s; hanya DIBUKA/PENUH dari pelatihan publik", async (instant, today) => {
    const at = new Date(instant);
    await resolveHomeSections([section("UPCOMING_SCHEDULES", { limit: 5 })], at);
    const args = mock.schedule.findMany.mock.calls[0][0];
    expect(args.where).toEqual({
      deletedAt: null,
      status: { in: ["OPEN", "FULL"] },
      endDate: { gte: new Date(`${today}T00:00:00.000Z`) },
      training: { deletedAt: null, status: "PUBLISHED", publishedAt: { lte: at } },
    });
    expect(args.orderBy).toEqual([{ startDate: "asc" }, { id: "asc" }]);
    expect(args.take).toBe(5);
  });
});

describe("publik & pratinjau", () => {
  it("publik: hanya section tampil, tanpa section kosong & tanpa flag pratinjau", async () => {
    mock.homeSection.findMany.mockResolvedValue([
      section("STATS", { items: [{ value: 1, label: "x" }] }),
      section("CLIENTS", { mode: "auto", limit: 10 }),
    ]);
    const home = await getPublicHome(now);
    expect(mock.homeSection.findMany.mock.calls[0][0].where).toEqual({ deletedAt: null, visible: true });
    expect(home.sections.map((item) => item.type)).toEqual(["STATS"]);
    expect(home.sections[0]).not.toHaveProperty("visible");
    expect(home.sections[0]).not.toHaveProperty("empty");
  });

  it("pratinjau: termasuk section tersembunyi dan kosong, dengan flag visible & empty", async () => {
    mock.homeSection.findMany.mockResolvedValue([
      section("STATS", { items: [{ value: 1, label: "x" }] }, { visible: false }),
      section("TESTIMONIALS", { mode: "auto", limit: 6 }),
    ]);
    const preview = await getHomePreview(now);
    expect(mock.homeSection.findMany.mock.calls[0][0].where).toEqual({ deletedAt: null });
    expect(preview.sections.map(({ type, visible, empty }) => ({ type, visible, empty }))).toEqual([
      { type: "STATS", visible: false, empty: false },
      { type: "TESTIMONIALS", visible: true, empty: true },
    ]);
  });
});
