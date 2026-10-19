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
  listCategories,
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
  imageId: null,
  image: null,
  _count: { trainings: 0 },
  ...extra,
});

const IMAGE_ID = "0199b4d0-0000-7000-8000-0000000000a1";
const imageMedia = (extra: Record<string, unknown> = {}) => ({
  id: IMAGE_ID,
  path: "2026/10/kategori.webp",
  originalName: "kategori.jpg",
  mime: "image/webp",
  size: 100,
  width: 1600,
  height: 900,
  alt: "Kelas keuangan",
  folder: null,
  variants: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  updatedById: null,
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

  it("gambar kategori: uuid atau null (default null); urut jumlah pelatihan; filter tanpa gambar", () => {
    expect(categoryCreateSchema.parse({ name: "X" }).imageId).toBeNull();
    expect(categoryCreateSchema.parse({ name: "X", imageId: IMAGE_ID }).imageId).toBe(IMAGE_ID);
    expect(categoryCreateSchema.safeParse({ name: "X", imageId: "bukan-uuid" }).success).toBe(false);
    expect(categoryUpdateSchema.parse({ imageId: null })).toMatchObject({ imageId: null });
    expect(categoryListQuerySchema.parse({ sort: "-trainingCount", issue: "no-image" })).toMatchObject({
      sort: { field: "trainingCount", direction: "desc" },
      issue: "no-image",
    });
    expect(categoryListQuerySchema.safeParse({ issue: "lain" }).success).toBe(false);
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
      { name: "Keuangan & Akuntansi", description: null, icon: null, featured: false, imageId: null },
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
        { name: "Keuangan", slug: "keuangan", description: null, icon: null, featured: false, imageId: null },
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

describe("gambar kategori (admin)", () => {
  it("create: gambar tanpa alt ditolak 422 di field imageId", async () => {
    mock.category.findFirst.mockResolvedValue(null);
    mock.media.findMany.mockResolvedValue([{ id: IMAGE_ID, mime: "image/webp", alt: null }]);
    await expect(
      createCategory({ name: "Keuangan", description: null, icon: null, featured: false, imageId: IMAGE_ID }, "u1"),
    ).rejects.toMatchObject({ status: 422, fields: { imageId: [expect.stringContaining("alt")] } });
    expect(mock.category.create).not.toHaveBeenCalled();
  });

  it("update: imageId disimpan, dicatat di audit, gambar ikut di DTO, pelatihan di-revalidate", async () => {
    mock.category.findFirst.mockResolvedValueOnce(category());
    mock.media.findMany.mockResolvedValue([{ id: IMAGE_ID, mime: "image/webp", alt: "Kelas keuangan" }]);
    mock.category.update.mockResolvedValue(category({ imageId: IMAGE_ID, image: imageMedia() }));
    mock.auditLog.create.mockResolvedValue({});

    const updated = await updateCategory(ID, { imageId: IMAGE_ID }, "u1");
    expect(mock.category.update.mock.calls[0][0].data).toMatchObject({ imageId: IMAGE_ID });
    expect(mock.auditLog.create.mock.calls[0][0].data.diff).toMatchObject({ imageId: { from: null, to: IMAGE_ID } });
    expect(updated).toMatchObject({ imageId: IMAGE_ID, image: { id: IMAGE_ID, alt: "Kelas keuangan" } });
    expect(revalidate).toHaveBeenCalledWith(expect.arrayContaining(["trainings", "category:keuangan"]));
  });

  it("update: lepas gambar (null) tanpa cek media", async () => {
    mock.category.findFirst.mockResolvedValueOnce(category({ imageId: IMAGE_ID }));
    mock.category.update.mockResolvedValue(category());
    mock.auditLog.create.mockResolvedValue({});
    await updateCategory(ID, { imageId: null }, "u1");
    expect(mock.media.findMany).not.toHaveBeenCalled();
    expect(mock.category.update.mock.calls[0][0].data).toMatchObject({ imageId: null });
  });

  it("DTO: media di Sampah dianggap kosong", async () => {
    mock.category.findMany.mockResolvedValue([category({ imageId: IMAGE_ID, image: imageMedia({ deletedAt: new Date() }) })]);
    mock.category.count.mockResolvedValue(1);
    const { items } = await listCategories(categoryListQuerySchema.parse({}));
    expect(items[0]).toMatchObject({ imageId: IMAGE_ID, image: null });
  });
});

describe("listCategories", () => {
  it("issue=no-image hanya kategori tanpa gambar", async () => {
    mock.category.findMany.mockResolvedValue([]);
    mock.category.count.mockResolvedValue(0);
    await listCategories(categoryListQuerySchema.parse({ issue: "no-image" }));
    expect(mock.category.findMany.mock.calls[0][0].where).toMatchObject({ deletedAt: null, imageId: null });
  });

  it("urut pelatihan aktif: dihitung tanpa pelatihan di Sampah, seri diurutkan nama, lalu dipaginasi", async () => {
    const row = (id: string, name: string, trainings: number) => ({ id, name, _count: { trainings } });
    const counts = () => [row("a", "Audit", 3), row("b", "Banking", 10), row("c", "Cargo", 3), row("d", "Data", 1)];
    mock.category.findMany
      .mockResolvedValueOnce(counts())
      .mockImplementationOnce(async ({ where }: { where: { id: { in: string[] } } }) =>
        // Urutan dari DB sengaja berbeda; service mengembalikan sesuai urutan hitungan.
        [...where.id.in].reverse().map((id) => category({ id, name: id.toUpperCase() })),
      );

    const result = await listCategories(categoryListQuerySchema.parse({ sort: "-trainingCount", pageSize: "2", page: "2" }));
    const countQuery = mock.category.findMany.mock.calls[0][0];
    expect(countQuery.select._count.select.trainings.where).toEqual({ training: { deletedAt: null } });
    expect(mock.category.findMany.mock.calls[1][0].where).toEqual({ id: { in: ["c", "d"] } });
    expect(result.items.map((item) => item.id)).toEqual(["c", "d"]);
    expect(result.meta).toMatchObject({ page: 2, pageSize: 2, total: 4 });

    mock.category.findMany.mockResolvedValueOnce(counts()).mockResolvedValueOnce([]);
    await listCategories(categoryListQuerySchema.parse({ sort: "trainingCount", pageSize: "3" }));
    expect(mock.category.findMany.mock.calls[3][0].where).toEqual({ id: { in: ["d", "a", "c"] } });
  });
});

describe("listPublicCategories", () => {
  it("gambar kategori aktif dikirim tanpa metadata admin; media di Sampah = null", async () => {
    mock.category.findMany.mockResolvedValue([
      category({ image: imageMedia() }),
      category({ slug: "lain", image: imageMedia({ deletedAt: new Date() }) }),
    ]);
    const [withImage, trashed] = await listPublicCategories();
    expect(withImage.image).toEqual({
      url: expect.stringContaining("2026/10/kategori.webp"),
      alt: "Kelas keuangan",
      width: 1600,
      height: 900,
      mime: "image/webp",
      variants: null,
    });
    expect(trashed.image).toBeNull();
    expect(mock.category.findMany.mock.calls[0][0].include.image).toBe(true);
  });

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
      image: null,
      trainingCount: 2,
    });
    expect(mock.category.findMany.mock.calls[0][0].include._count.select.trainings.where.training).toEqual({
      deletedAt: null,
      status: "PUBLISHED",
      publishedAt: { lte: now },
    });
  });
});
