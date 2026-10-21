import { beforeEach, describe, expect, it, vi } from "vitest";
import { keywordLinkSchema } from "@/lib/validators/category";
import { createMockDb, passThroughTransactions, type MockDb } from "@/test/mock-db";

const db = vi.hoisted(() => ({ current: undefined as unknown }));
vi.mock("@/lib/db", () => ({ getDb: () => db.current }));
const revalidate = vi.hoisted(() => vi.fn());
vi.mock("@/lib/revalidate", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/revalidate")>()),
  revalidateTags: revalidate,
}));

import { KEYWORD_MATCH_LIMIT, linkKeywordMatches, listKeywordMatches } from "@/services/category-keywords";

const ID = "0199b4d0-0000-7000-8000-000000000001";
const T1 = "0199b4d0-0000-7000-8000-0000000000b1";
const T2 = "0199b4d0-0000-7000-8000-0000000000b2";

const category = (extra: Record<string, unknown> = {}) => ({
  id: ID,
  slug: "drone",
  name: "Drone",
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
  keywords: ["drone"],
  _count: { trainings: 1 },
  ...extra,
});

let mock: MockDb;
beforeEach(() => {
  mock = createMockDb();
  db.current = mock;
  passThroughTransactions(mock);
  revalidate.mockReset();
});

// Nilai parameter yang dikirim ke $queryRaw (Prisma.Sql).
const queryValues = () => (mock.$queryRaw.mock.calls[0][0] as { values: unknown[] }).values;

describe("listKeywordMatches", () => {
  it("tanpa kata kunci: tidak query sama sekali", async () => {
    mock.category.findFirst.mockResolvedValue(category({ keywords: [] }));
    await expect(listKeywordMatches(ID)).resolves.toEqual({ keywords: [], items: [], total: 0, linkedCount: 0 });
    expect(mock.$queryRaw).not.toHaveBeenCalled();
  });

  it("pola kata utuh sebagai parameter; hanya yang belum tertaut dikembalikan, urutan query dipertahankan", async () => {
    mock.category.findFirst.mockResolvedValue(category({ keywords: ["Drone", "foto udara"] }));
    mock.$queryRaw.mockResolvedValue([
      { id: T2, linked: false },
      { id: "sudah", linked: true },
      { id: T1, linked: false },
    ]);
    mock.training.findMany.mockResolvedValue([
      { id: T1, slug: "a", title: "A drone", status: "DRAFT", publishedAt: null, categories: [] },
      {
        id: T2,
        slug: "b",
        title: "B drone",
        status: "PUBLISHED",
        publishedAt: new Date("2099-01-01T00:00:00Z"),
        categories: [{ category: { id: "c2", name: "Photography" } }, { category: { id: "c1", name: "Media" } }],
      },
    ]);
    const result = await listKeywordMatches(ID);
    expect(queryValues()).toEqual([
      ID,
      ["(^|[^[:alnum:]])drone($|[^[:alnum:]])", "(^|[^[:alnum:]])foto udara($|[^[:alnum:]])"],
    ]);
    expect(result.total).toBe(2);
    expect(result.linkedCount).toBe(1);
    expect(result.items.map((item) => item.id)).toEqual([T2, T1]);
    expect(result.items.map((item) => item.publicState)).toEqual(["SCHEDULED", "DRAFT"]);
    expect(result.items[0].categories.map((item) => item.name)).toEqual(["Media", "Photography"]);
    expect(mock.training.findMany.mock.calls[0][0].select.categories.where).toEqual({ category: { deletedAt: null } });
  });

  it(`paling banyak ${KEYWORD_MATCH_LIMIT} item, total tetap semua`, async () => {
    mock.category.findFirst.mockResolvedValue(category());
    mock.$queryRaw.mockResolvedValue(
      Array.from({ length: KEYWORD_MATCH_LIMIT + 5 }, (_, index) => ({ id: `t${index}`, linked: false })),
    );
    mock.training.findMany.mockResolvedValue([]);
    const result = await listKeywordMatches(ID);
    expect(result.total).toBe(KEYWORD_MATCH_LIMIT + 5);
    expect(mock.training.findMany.mock.calls[0][0].where.id.in).toHaveLength(KEYWORD_MATCH_LIMIT);
  });

  it("404 kalau kategori tidak aktif", async () => {
    mock.category.findFirst.mockResolvedValue(null);
    await expect(listKeywordMatches(ID)).rejects.toMatchObject({ status: 404 });
  });
});

describe("linkKeywordMatches", () => {
  it("validator: minimal satu, id unik", () => {
    expect(keywordLinkSchema.safeParse({ trainingIds: [] }).success).toBe(false);
    expect(keywordLinkSchema.safeParse({ trainingIds: [T1, T1] }).success).toBe(false);
    expect(keywordLinkSchema.parse({ trainingIds: [T1] })).toEqual({ trainingIds: [T1] });
  });

  it("memindah pelatihan ke kategori ini (kategori lama dilepas), menandai diubah admin, audit + revalidate", async () => {
    mock.category.findFirst.mockResolvedValue(category());
    mock.training.findMany.mockResolvedValue([
      { id: T1, slug: "a", categories: [{ category: { id: "c-geo", slug: "geology" } }] },
      { id: T2, slug: "b", categories: [] },
    ]);
    await expect(linkKeywordMatches(ID, { trainingIds: [T1, T2] }, "u1")).resolves.toEqual({ linked: 2 });
    expect(mock.training.findMany.mock.calls[0][0].where).toEqual({ id: { in: [T1, T2] }, deletedAt: null });
    expect(mock.trainingCategory.deleteMany).toHaveBeenCalledWith({
      where: { trainingId: { in: [T1, T2] }, categoryId: { not: ID } },
    });
    expect(mock.trainingCategory.createMany).toHaveBeenCalledWith({
      data: [
        { trainingId: T1, categoryId: ID },
        { trainingId: T2, categoryId: ID },
      ],
      skipDuplicates: true,
    });
    expect(mock.training.updateMany).toHaveBeenCalledWith({ where: { id: { in: [T1, T2] } }, data: { updatedById: "u1" } });
    expect(mock.auditLog.create.mock.calls[0][0].data).toMatchObject({
      action: "UPDATE",
      entity: "Category",
      entityId: ID,
      diff: { movedTrainings: [T1, T2], fromCategories: ["c-geo"], source: "keywords" },
    });
    expect(revalidate).toHaveBeenCalledWith(
      expect.arrayContaining(["categories", "trainings", "category:drone", "category:geology", "training:a", "training:b"]),
    );
  });

  it("422 kalau sebagian pelatihan sudah dihapus", async () => {
    mock.category.findFirst.mockResolvedValue(category());
    mock.training.findMany.mockResolvedValue([{ id: T1, slug: "a", categories: [] }]);
    await expect(linkKeywordMatches(ID, { trainingIds: [T1, T2] }, "u1")).rejects.toMatchObject({
      status: 422,
      fields: { trainingIds: [expect.any(String)] },
    });
    expect(mock.trainingCategory.createMany).not.toHaveBeenCalled();
  });
});
