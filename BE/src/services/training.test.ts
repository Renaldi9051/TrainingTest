import { beforeEach, describe, expect, it, vi } from "vitest";
import { trainingCreateSchema } from "@/lib/validators/training";
import { createMockDb, passThroughTransactions, type MockDb } from "@/test/mock-db";

const db = vi.hoisted(() => ({ current: undefined as unknown }));
vi.mock("@/lib/db", () => ({ getDb: () => db.current }));
const revalidate = vi.hoisted(() => vi.fn(async () => true));
vi.mock("@/lib/revalidate", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/revalidate")>()),
  revalidateTags: revalidate,
}));

import {
  bulkTrainings,
  createTraining,
  duplicateTraining,
  restoreTraining,
  updateTraining,
} from "@/services/training";

const ID = "0199b4d0-0000-7000-8000-000000000001";
const CATEGORY = "0199b4d0-0000-7000-8000-0000000000c1";
const now = new Date("2026-10-10T05:00:00.000Z");

function row(extra: Record<string, unknown> = {}) {
  return {
    id: ID,
    slug: "kpi",
    title: "KPI",
    summary: null,
    body: null,
    objectives: null,
    syllabus: null,
    audience: null,
    facilities: null,
    duration: null,
    method: null,
    types: [],
    priceText: null,
    showPrice: false,
    coverId: null,
    cover: null,
    status: "DRAFT",
    publishedAt: null,
    publishRevalidatedAt: null,
    seo: null,
    searchTitle: "kpi",
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    updatedById: null,
    categories: [{ categoryId: CATEGORY, category: { id: CATEGORY, slug: "sdm", name: "SDM", order: 0, deletedAt: null } }],
    _count: { schedules: 0 },
    ...extra,
  };
}

let mock: MockDb;
beforeEach(() => {
  mock = createMockDb();
  db.current = mock;
  passThroughTransactions(mock);
  revalidate.mockClear();
  mock.category.count.mockResolvedValue(1);
  mock.media.findMany.mockResolvedValue([]);
  mock.redirect.findFirst.mockResolvedValue(null);
  mock.redirect.create.mockResolvedValue({ id: "r1" });
  mock.training.findFirst.mockResolvedValue(null);
  // Data create berisi `categories: { create }`; relasi hasil tetap dari row().
  mock.training.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
    const fields = { ...data };
    delete fields.categories;
    return row(fields);
  });
  mock.training.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => row(data));
});

const input = (extra: Record<string, unknown> = {}) =>
  trainingCreateSchema.parse({ title: "Manajemen Kinerja", categoryIds: [CATEGORY], ...extra });

describe("createTraining", () => {
  it("draft: slug otomatis, tidak me-revalidate halaman publik", async () => {
    const created = await createTraining(input(), "u1", now);
    expect(created.slug).toBe("manajemen-kinerja");
    expect(created.publicState).toBe("DRAFT");
    expect(mock.training.create.mock.calls[0][0].data).toMatchObject({
      status: "DRAFT",
      publishedAt: null,
      publishRevalidatedAt: null,
      categories: { create: [{ categoryId: CATEGORY }] },
    });
    expect(revalidate).not.toHaveBeenCalled();
  });

  it("publish tanpa waktu: tayang sekarang dan langsung revalidate", async () => {
    await createTraining(input({ status: "PUBLISHED" }), "u1", now);
    expect(mock.training.create.mock.calls[0][0].data).toMatchObject({
      publishedAt: now,
      publishRevalidatedAt: now,
    });
    expect(revalidate).toHaveBeenCalledWith(expect.arrayContaining(["trainings", "training:manajemen-kinerja"]));
  });

  it("publish terjadwal: penanda revalidate kosong (diurus scheduler), belum revalidate", async () => {
    const created = await createTraining(input({ status: "PUBLISHED", publishedAt: "2026-10-12T09:00:00+07:00" }), "u1", now);
    expect(mock.training.create.mock.calls[0][0].data.publishRevalidatedAt).toBeNull();
    expect(created.publicState).toBe("SCHEDULED");
    expect(revalidate).not.toHaveBeenCalled();
  });

  it("kategori tidak aktif ditolak 422", async () => {
    mock.category.count.mockResolvedValue(0);
    await expect(createTraining(input(), "u1", now)).rejects.toMatchObject({
      status: 422,
      fields: { categoryIds: [expect.any(String)] },
    });
  });
});

describe("updateTraining", () => {
  it("slug pelatihan published berubah: redirect 301 + revalidate slug lama & baru", async () => {
    mock.training.findFirst
      .mockResolvedValueOnce(row({ status: "PUBLISHED", publishedAt: new Date("2026-10-01T00:00:00Z"), publishRevalidatedAt: now }))
      .mockResolvedValueOnce(null);
    await updateTraining(ID, { slug: "kpi-baru" }, "u1", now);
    expect(mock.redirect.create.mock.calls[0][0].data).toMatchObject({
      from: "/pelatihan/kpi",
      to: "/pelatihan/kpi-baru",
    });
    expect(revalidate.mock.calls[0][0]).toEqual(expect.arrayContaining(["training:kpi", "training:kpi-baru"]));
  });

  it("slug draft berubah: tidak ada redirect", async () => {
    mock.training.findFirst.mockResolvedValueOnce(row()).mockResolvedValueOnce(null);
    await updateTraining(ID, { slug: "kpi-baru" }, "u1", now);
    expect(mock.redirect.create).not.toHaveBeenCalled();
  });

  it("menyalakan harga tanpa teks investasi ditolak", async () => {
    mock.training.findFirst.mockResolvedValueOnce(row());
    await expect(updateTraining(ID, { showPrice: true }, "u1", now)).rejects.toMatchObject({
      status: 422,
      fields: { priceText: [expect.any(String)] },
    });
  });

  it("kategori diganti dalam transaksi yang sama", async () => {
    mock.training.findFirst.mockResolvedValueOnce(row());
    await updateTraining(ID, { categoryIds: [CATEGORY] }, "u1", now);
    expect(mock.trainingCategory.deleteMany).toHaveBeenCalledWith({ where: { trainingId: ID } });
    expect(mock.trainingCategory.createMany).toHaveBeenCalledWith({ data: [{ trainingId: ID, categoryId: CATEGORY }] });
  });
});

describe("duplicateTraining", () => {
  it('judul + " (salinan)", status DRAFT, slug baru', async () => {
    mock.training.findFirst
      .mockResolvedValueOnce(row({ status: "PUBLISHED", publishedAt: now }))
      .mockImplementation(async ({ where }: { where: { slug?: string } }) =>
        where.slug === "kpi-salinan" ? { id: "lain" } : null,
      );
    const copy = await duplicateTraining(ID, "u1");
    expect(mock.training.create.mock.calls[0][0].data).toMatchObject({
      title: "KPI (salinan)",
      slug: "kpi-salinan-2",
      status: "DRAFT",
      publishedAt: null,
    });
    expect(copy.publicState).toBe("DRAFT");
    expect(revalidate).not.toHaveBeenCalled();
  });
});

describe("bulkTrainings", () => {
  beforeEach(() => {
    mock.training.findMany.mockResolvedValue([
      { id: "a", slug: "a" },
      { id: "b", slug: "b" },
    ]);
  });

  it("publish: waktu publish kosong/terjadwal jadi sekarang, status PUBLISHED, revalidate semua slug", async () => {
    await bulkTrainings({ action: "publish", ids: ["a", "b"] }, "u1", now);
    expect(mock.training.updateMany.mock.calls[0][0]).toMatchObject({
      where: { id: { in: ["a", "b"] }, OR: [{ publishedAt: null }, { publishedAt: { gt: now } }] },
      data: { publishedAt: now },
    });
    expect(mock.training.updateMany.mock.calls[1][0].data).toMatchObject({ status: "PUBLISHED" });
    expect(revalidate.mock.calls[0][0]).toEqual(expect.arrayContaining(["training:a", "training:b"]));
  });

  it("ganti kategori: semua kategori lama diganti satu kategori", async () => {
    await bulkTrainings({ action: "set-category", ids: ["a", "b"], categoryId: CATEGORY }, "u1", now);
    expect(mock.trainingCategory.deleteMany).toHaveBeenCalledWith({ where: { trainingId: { in: ["a", "b"] } } });
    expect(mock.trainingCategory.createMany.mock.calls[0][0].data).toEqual([
      { trainingId: "a", categoryId: CATEGORY },
      { trainingId: "b", categoryId: CATEGORY },
    ]);
    expect(mock.auditLog.create.mock.calls[0][0].data).toMatchObject({ action: "BULK" });
  });

  it("id yang tidak ada/terhapus: 422 dan tidak ada perubahan", async () => {
    await expect(bulkTrainings({ action: "delete", ids: ["a", "b", "c"] }, "u1", now)).rejects.toMatchObject({
      status: 422,
    });
    expect(mock.$transaction).not.toHaveBeenCalled();
  });
});

describe("restoreTraining", () => {
  it("slug lama sudah dipakai: 409, minta slug baru", async () => {
    mock.training.findFirst
      .mockResolvedValueOnce(row({ deletedAt: now }))
      .mockResolvedValueOnce({ id: "lain" });
    await expect(restoreTraining(ID, { slug: undefined }, "u1")).rejects.toMatchObject({
      status: 409,
      code: "SLUG_TAKEN",
    });
  });
});
