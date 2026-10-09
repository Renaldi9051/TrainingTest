import { beforeEach, describe, expect, it, vi } from "vitest";
import { categoryCreateSchema, categoryListQuerySchema, categoryUpdateSchema } from "@/lib/validators/category";
import { createMockDb, passThroughTransactions, type MockDb } from "@/test/mock-db";

const db = vi.hoisted(() => ({ current: undefined as unknown }));
vi.mock("@/lib/db", () => ({ getDb: () => db.current }));
const revalidate = vi.hoisted(() => vi.fn());
vi.mock("@/lib/revalidate", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/revalidate")>()),
  revalidateTags: revalidate,
}));

import {
  createCategory,
  deleteCategory,
  listPublicCategories,
  reorderCategories,
  restoreCategory,
  updateCategory,
} from "@/services/category";

const ID = "0199b4d0-0000-7000-8000-000000000001";
const category = (extra: Record<string, unknown> = {}) => ({
  id: ID,
  slug: "keuangan",
  name: "Keuangan",
  description: null,
  icon: null,
  order: 0,
  featured: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  updatedById: null,
  _count: { trainings: 0 },
  ...extra,
});

let mock: MockDb;
beforeEach(() => {
  mock = createMockDb();
  db.current = mock;
  passThroughTransactions(mock);
  revalidate.mockReset();
  mock.category.aggregate.mockResolvedValue({ _max: { order: 4 } });
  mock.redirect.findFirst.mockResolvedValue(null);
  mock.redirect.create.mockResolvedValue({ id: "r1" });
});

describe("validator kategori", () => {
  it("ikon hanya dari allowlist; slug kosong = otomatis", () => {
    expect(categoryCreateSchema.parse({ name: "Keuangan", slug: "", icon: "calculator" })).toMatchObject({
      slug: undefined,
      icon: "calculator",
      featured: false,
      description: null,
    });
    expect(categoryCreateSchema.safeParse({ name: "X", icon: "skull" }).success).toBe(false);
    expect(categoryCreateSchema.safeParse({ name: "X", icon: "<svg onload=x>" }).success).toBe(false);
    expect(categoryCreateSchema.safeParse({ name: "X", slug: "Bukan Slug" }).success).toBe(false);
    expect(categoryCreateSchema.safeParse({ name: "  " }).success).toBe(false);
    expect(categoryUpdateSchema.safeParse({}).success).toBe(false);
  });

  it("query list: default urut 'order', filter unggulan", () => {
    expect(categoryListQuerySchema.parse({ featured: "true" })).toMatchObject({
      sort: { field: "order", direction: "asc" },
      featured: true,
    });
  });
});

describe("createCategory", () => {
  it("slug otomatis dari nama dengan sufiks kalau sudah dipakai", async () => {
    mock.category.findFirst.mockImplementation(async ({ where }: { where: { slug: string } }) =>
      where.slug === "keuangan-dan-akuntansi" ? { id: "lain" } : null,
    );
    mock.category.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) =>
      category(data),
    );

    const created = await createCategory(
      { name: "Keuangan & Akuntansi", description: null, icon: null, featured: false },
      "u1",
    );
    expect(created.slug).toBe("keuangan-dan-akuntansi-2");
    expect(mock.category.create.mock.calls[0][0].data.order).toBe(5);
    expect(revalidate).toHaveBeenCalledWith(
      expect.arrayContaining(["categories", "trainings", "category:keuangan-dan-akuntansi-2"]),
    );
  });

  it("slug yang ditulis admin dan bentrok = 409 fields.slug", async () => {
    mock.category.findFirst.mockResolvedValue({ id: "lain" });
    await expect(
      createCategory(
        { name: "Keuangan", slug: "keuangan", description: null, icon: null, featured: false },
        "u1",
      ),
    ).rejects.toMatchObject({ status: 409, fields: { slug: [expect.any(String)] } });
    expect(mock.category.create).not.toHaveBeenCalled();
  });
});

describe("updateCategory", () => {
  it("slug berubah: redirect 301 dicatat dan tag slug lama + baru di-revalidate", async () => {
    mock.category.findFirst
      .mockResolvedValueOnce(category()) // findActive
      .mockResolvedValueOnce(null); // cek slug baru
    mock.category.update.mockResolvedValue(category({ slug: "keuangan-bisnis" }));

    await updateCategory(ID, { slug: "keuangan-bisnis" }, "u1");

    expect(mock.redirect.create.mock.calls[0][0].data).toMatchObject({
      from: "/pelatihan/kategori/keuangan",
      to: "/pelatihan/kategori/keuangan-bisnis",
      code: "PERMANENT",
    });
    expect(mock.auditLog.create.mock.calls.at(-1)?.[0].data).toMatchObject({
      action: "UPDATE",
      diff: { slug: { from: "keuangan", to: "keuangan-bisnis" } },
    });
    expect(revalidate.mock.calls[0][0]).toEqual(
      expect.arrayContaining(["category:keuangan", "category:keuangan-bisnis"]),
    );
  });

  it("slug tidak berubah: tidak ada redirect", async () => {
    mock.category.findFirst.mockResolvedValueOnce(category());
    mock.category.update.mockResolvedValue(category({ name: "Keuangan Baru" }));
    await updateCategory(ID, { name: "Keuangan Baru", slug: "keuangan" }, "u1");
    expect(mock.redirect.create).not.toHaveBeenCalled();
  });
});

describe("deleteCategory", () => {
  it("409 kalau masih dipakai pelatihan aktif", async () => {
    mock.category.findFirst.mockResolvedValue(category({ _count: { trainings: 3 } }));
    await expect(deleteCategory(ID, "u1")).rejects.toMatchObject({
      status: 409,
      code: "CATEGORY_IN_USE",
    });
    expect(mock.category.update).not.toHaveBeenCalled();
  });

  it("soft delete + audit + revalidate kalau tidak dipakai", async () => {
    mock.category.findFirst.mockResolvedValue(category());
    await deleteCategory(ID, "u1");
    expect(mock.category.update.mock.calls[0][0].data.deletedAt).toBeInstanceOf(Date);
    expect(mock.auditLog.create.mock.calls[0][0].data).toMatchObject({ action: "DELETE" });
    expect(revalidate).toHaveBeenCalled();
  });
});

describe("restoreCategory", () => {
  it("409 kalau slug lama sudah dipakai kategori aktif lain", async () => {
    mock.category.findFirst
      .mockResolvedValueOnce(category({ deletedAt: new Date() }))
      .mockResolvedValueOnce({ id: "lain" });
    await expect(restoreCategory(ID, { slug: undefined }, "u1")).rejects.toMatchObject({
      status: 409,
      code: "SLUG_TAKEN",
    });
  });

  it("bisa dipulihkan dengan slug baru", async () => {
    mock.category.findFirst
      .mockResolvedValueOnce(category({ deletedAt: new Date() }))
      .mockResolvedValueOnce(null);
    mock.category.update.mockResolvedValue(category({ slug: "keuangan-lama" }));
    const restored = await restoreCategory(ID, { slug: "keuangan-lama" }, "u1");
    expect(restored.slug).toBe("keuangan-lama");
    expect(mock.category.update.mock.calls[0][0].data).toMatchObject({ deletedAt: null, slug: "keuangan-lama" });
  });
});

describe("reorderCategories", () => {
  it("wajib berisi semua kategori aktif", async () => {
    mock.category.findMany.mockResolvedValue([{ id: "a" }, { id: "b" }]);
    await expect(reorderCategories({ ids: ["a"] }, "u1")).rejects.toMatchObject({ status: 422 });
    await reorderCategories({ ids: ["b", "a"] }, "u1");
    expect(mock.category.update.mock.calls.map((call) => [call[0].where.id, call[0].data.order])).toEqual([
      ["b", 0],
      ["a", 1],
    ]);
  });
});

describe("listPublicCategories", () => {
  it("jumlah pelatihan hanya menghitung yang tampil publik", async () => {
    const now = new Date("2026-10-10T00:00:00Z");
    mock.category.findMany.mockResolvedValue([category({ _count: { trainings: 2 } })]);
    const result = await listPublicCategories(now);
    expect(result[0]).toEqual({
      slug: "keuangan",
      name: "Keuangan",
      description: null,
      icon: null,
      featured: false,
      trainingCount: 2,
    });
    expect(mock.category.findMany.mock.calls[0][0].include._count.select.trainings.where.training).toEqual({
      deletedAt: null,
      status: "PUBLISHED",
      publishedAt: { lte: now },
    });
  });
});
