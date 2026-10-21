import { beforeEach, describe, expect, it, vi } from "vitest";
import { categoryMergeSchema } from "@/lib/validators/category";
import { createMockDb, passThroughTransactions, type MockDb } from "@/test/mock-db";

const db = vi.hoisted(() => ({ current: undefined as unknown }));
vi.mock("@/lib/db", () => ({ getDb: () => db.current }));
const revalidate = vi.hoisted(() => vi.fn());
vi.mock("@/lib/revalidate", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/revalidate")>()),
  revalidateTags: revalidate,
}));

import { mergeCategory, mergeKeywords } from "@/services/category-merge";

const SOURCE = "0199b4d0-0000-7000-8000-000000000001";
const TARGET = "0199b4d0-0000-7000-8000-000000000002";

const category = (extra: Record<string, unknown> = {}) => ({
  id: SOURCE,
  slug: "manufactur",
  name: "Manufactur",
  description: null,
  icon: null,
  order: 0,
  featured: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  updatedById: null,
  imageId: null,
  image: null,
  keywords: [],
  _count: { trainings: 2 },
  ...extra,
});

const source = (extra: Record<string, unknown> = {}) => category(extra);
const target = (extra: Record<string, unknown> = {}) =>
  category({ id: TARGET, slug: "manufacture", name: "manufacture", ...extra });

let mock: MockDb;
beforeEach(() => {
  mock = createMockDb();
  db.current = mock;
  passThroughTransactions(mock);
  revalidate.mockReset();
  mock.redirect.findFirst.mockResolvedValue(null);
  mock.redirect.create.mockResolvedValue({ id: "r1" });
  mock.navItem.findMany.mockResolvedValue([]);
  mock.navItem.findFirst.mockResolvedValue(null);
  mock.trainingCategory.findMany.mockResolvedValue([]);
});

// findActiveCategory(sumber), findActiveCategory(tujuan), getCategory(tujuan) setelah transaksi.
function mockCategories(sourceRow = source(), targetRow = target()) {
  mock.category.findFirst
    .mockResolvedValueOnce(sourceRow)
    .mockResolvedValueOnce(targetRow)
    .mockResolvedValueOnce(targetRow);
}

describe("mergeCategory", () => {
  it("validator: targetId uuid", () => {
    expect(categoryMergeSchema.safeParse({ targetId: "x" }).success).toBe(false);
    expect(categoryMergeSchema.parse({ targetId: TARGET })).toEqual({ targetId: TARGET });
  });

  it("422 kalau tujuan sama dengan sumber", async () => {
    await expect(mergeCategory(SOURCE, { targetId: SOURCE }, "u1")).rejects.toMatchObject({
      status: 422,
      fields: { targetId: [expect.any(String)] },
    });
  });

  it("422 di field targetId kalau tujuan tidak aktif", async () => {
    mock.category.findFirst.mockResolvedValueOnce(source()).mockResolvedValueOnce(null);
    await expect(mergeCategory(SOURCE, { targetId: TARGET }, "u1")).rejects.toMatchObject({
      status: 422,
      fields: { targetId: [expect.any(String)] },
    });
    expect(mock.category.update).not.toHaveBeenCalled();
  });

  it("memindah tautan, sumber ke Sampah, redirect 301, audit dua kategori, revalidate", async () => {
    mockCategories(source({ featured: true, keywords: ["manufaktur"] }), target({ keywords: ["Manufacture"] }));
    mock.trainingCategory.findMany.mockResolvedValue([
      { trainingId: "t1", training: { slug: "a", deletedAt: null } },
      { trainingId: "t2", training: { slug: "b", deletedAt: new Date() } },
    ]);
    const result = await mergeCategory(SOURCE, { targetId: TARGET }, "u1");

    expect(result.movedTrainings).toBe(2);
    expect(result.target.id).toBe(TARGET);
    expect(mock.trainingCategory.createMany).toHaveBeenCalledWith({
      data: [
        { trainingId: "t1", categoryId: TARGET },
        { trainingId: "t2", categoryId: TARGET },
      ],
      skipDuplicates: true,
    });
    expect(mock.trainingCategory.deleteMany).toHaveBeenCalledWith({ where: { categoryId: SOURCE } });
    // Hanya pelatihan aktif yang ditandai diubah admin.
    expect(mock.training.updateMany).toHaveBeenCalledWith({ where: { id: { in: ["t1"] } }, data: { updatedById: "u1" } });
    expect(mock.category.update).toHaveBeenNthCalledWith(1, {
      where: { id: TARGET },
      data: { keywords: ["Manufacture", "manufaktur"], featured: true, updatedById: "u1" },
    });
    expect(mock.category.update.mock.calls[1][0]).toMatchObject({ where: { id: SOURCE }, data: { updatedById: "u1" } });
    expect(mock.category.update.mock.calls[1][0].data.deletedAt).toBeInstanceOf(Date);
    expect(mock.redirect.create.mock.calls[0][0].data).toMatchObject({
      from: "/pelatihan/kategori/manufactur",
      to: "/pelatihan/kategori/manufacture",
      code: "PERMANENT",
    });
    const audits = mock.auditLog.create.mock.calls.map((call) => call[0].data);
    expect(audits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ entity: "Redirect", diff: expect.objectContaining({ reason: "kategori digabung" }) }),
        expect.objectContaining({ entity: "Category", entityId: SOURCE, action: "DELETE" }),
        expect.objectContaining({
          entity: "Category",
          entityId: TARGET,
          action: "UPDATE",
          diff: expect.objectContaining({ movedTrainings: ["t1", "t2"] }),
        }),
      ]),
    );
    expect(revalidate).toHaveBeenCalledWith(
      expect.arrayContaining(["category:manufacture", "category:manufactur", "training:a"]),
    );
    expect(revalidate.mock.calls[0][0]).not.toContain("training:b");
    expect(revalidate.mock.calls[0][0]).not.toContain("nav");
  });

  it("menu: item ke sumber diarahkan ke tujuan (label ikut), atau ke Sampah kalau grupnya sudah punya tujuan", async () => {
    mockCategories();
    mock.navItem.findMany.mockResolvedValue([
      { id: "n1", location: "HEADER", parentId: "p1", label: "Manufactur", href: "/pelatihan/kategori/manufactur" },
      { id: "n2", location: "FOOTER", parentId: null, label: "Pabrik", href: "/pelatihan?kategori=manufactur" },
      { id: "n3", location: "HEADER", parentId: "p2", label: "Manufactur", href: "/pelatihan/kategori/manufactur" },
    ]);
    mock.navItem.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "sudah-ada" });
    await mergeCategory(SOURCE, { targetId: TARGET }, "u1");

    expect(mock.navItem.update).toHaveBeenCalledWith({
      where: { id: "n1" },
      data: { href: "/pelatihan/kategori/manufacture", label: "manufacture", updatedById: "u1" },
    });
    expect(mock.navItem.update).toHaveBeenCalledWith({
      where: { id: "n2" },
      data: { href: "/pelatihan?kategori=manufacture", updatedById: "u1" },
    });
    expect(mock.navItem.updateMany).toHaveBeenCalledWith({
      where: { OR: [{ id: "n3" }, { parentId: "n3" }], deletedAt: null },
      data: { deletedAt: expect.any(Date), updatedById: "u1" },
    });
    expect(revalidate).toHaveBeenCalledWith(expect.arrayContaining(["nav"]));
  });
});

describe("mergeKeywords", () => {
  it("tanpa duplikat beda huruf, urutan tujuan dulu, maksimal 20", () => {
    expect(mergeKeywords(["Drone"], ["drone", "uav"])).toEqual(["Drone", "uav"]);
    const many = Array.from({ length: 15 }, (_, index) => `k${index}`);
    expect(mergeKeywords(many, many.map((value) => `${value}x`))).toHaveLength(20);
  });
});
