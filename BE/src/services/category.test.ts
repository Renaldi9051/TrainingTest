import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  categoryCreateSchema,
  categoryDeleteQuerySchema,
  categoryListQuerySchema,
  categoryUpdateSchema,
  publicCategoryGridQuerySchema,
} from "@/lib/validators/category";
import { createMockDb, passThroughTransactions, type MockDb } from "@/test/mock-db";

const db = vi.hoisted(() => ({ current: undefined as unknown }));
vi.mock("@/lib/db", () => ({ getDb: () => db.current }));
const revalidate = vi.hoisted(() => vi.fn());
vi.mock("@/lib/revalidate", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/revalidate")>()),
  revalidateTags: revalidate,
}));

import {
  categoryIndexLetter,
  createCategory,
  deleteCategory,
  getPublicCategory,
  listCategories,
  listPublicCategories,
  listPublicCategoryGrid,
  normalizeAudienceSource,
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
  summary: null,
  icon: null,
  order: 0,
  featured: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  updatedById: null,
  imageId: null,
  image: null,
  coverAlt: null,
  audience: [],
  audienceSource: "manual",
  keywords: [],
  images: [],
  _count: { trainings: 0 },
  ...extra,
});

// Input lengkap untuk createCategory (CategoryCreateInput sudah ter-parse).
const createInput = (extra: Record<string, unknown> = {}) => ({
  name: "Keuangan",
  description: null,
  summary: null,
  icon: null,
  featured: false,
  imageId: null,
  coverAlt: null,
  audience: [],
  audienceSource: "manual" as const,
  imageIds: [],
  keywords: [],
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
  mock.navItem.findMany.mockResolvedValue([]);
});

describe("validator kategori", () => {
  it("kata kunci: spasi dirapikan, duplikat beda huruf dibuang, batas jumlah & panjang", () => {
    expect(categoryCreateSchema.parse({ name: "Drone", keywords: ["  drone ", "Drone", "foto   udara"] }).keywords).toEqual([
      "drone",
      "foto udara",
    ]);
    expect(categoryCreateSchema.parse({ name: "Drone" }).keywords).toEqual([]);
    expect(categoryUpdateSchema.safeParse({ keywords: ["a"] }).success).toBe(false);
    expect(categoryUpdateSchema.safeParse({ keywords: ["--"] }).success).toBe(false);
    expect(categoryUpdateSchema.safeParse({ keywords: ["x".repeat(61)] }).success).toBe(false);
    expect(categoryUpdateSchema.safeParse({ keywords: Array.from({ length: 21 }, (_, i) => `kata ${i}`) }).success).toBe(false);
    expect(categoryUpdateSchema.parse({ keywords: [] })).toEqual({ keywords: [] });
  });

  it("hapus: detach hanya dari ?detach=true", () => {
    expect(categoryDeleteQuerySchema.parse({})).toEqual({ detach: false });
    expect(categoryDeleteQuerySchema.parse({ detach: "true" })).toEqual({ detach: true });
    expect(categoryDeleteQuerySchema.safeParse({ detach: "ya" }).success).toBe(false);
  });

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
      // data.images di sini berbentuk payload tulis Prisma ({ create: [...] }); DTO butuh relasi
      // yang sudah dimuat, jadi mock mengembalikan galeri kosong seperti adminInclude yang resolved.
      category({ ...data, images: [] }),
    );

    const created = await createCategory(
      createInput({ name: "Keuangan & Akuntansi" }),
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
        createInput({ name: "Keuangan", slug: "keuangan" }),
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
    expect(mock.trainingCategory.deleteMany).not.toHaveBeenCalled();
  });

  it("item menu ke halaman kategori (dan submenunya) ikut ke Sampah, nav di-revalidate", async () => {
    mock.category.findFirst.mockResolvedValue(category());
    mock.navItem.findMany.mockResolvedValue([{ id: "nav-1" }]);
    await deleteCategory(ID, "u1");
    expect(mock.navItem.findMany.mock.calls[0][0].where.href.in).toEqual([
      "/pelatihan/kategori/keuangan",
      "/pelatihan?kategori=keuangan",
    ]);
    expect(mock.navItem.updateMany.mock.calls[0][0]).toMatchObject({
      where: { OR: [{ id: { in: ["nav-1"] } }, { parentId: { in: ["nav-1"] } }] },
      data: { updatedById: "u1" },
    });
    expect(mock.auditLog.create.mock.calls[0][0].data.diff).toMatchObject({ removedNavItems: ["nav-1"] });
    expect(revalidate).toHaveBeenCalledWith(expect.arrayContaining(["nav", "category:keuangan"]));
  });

  it("detach: tautan dilepas lalu dihapus kalau semua pelatihan masih punya kategori lain", async () => {
    mock.category.findFirst.mockResolvedValue(category({ _count: { trainings: 2 } }));
    mock.training.findMany.mockResolvedValue([
      { id: "t1", slug: "a", title: "A", categories: [{ categoryId: "lain" }] },
      { id: "t2", slug: "b", title: "B", categories: [{ categoryId: "lain" }, { categoryId: "lain-2" }] },
    ]);
    await deleteCategory(ID, "u1", { detach: true });
    expect(mock.training.findMany.mock.calls[0][0].select.categories.where).toMatchObject({
      categoryId: { not: ID },
      category: { deletedAt: null },
    });
    expect(mock.trainingCategory.deleteMany).toHaveBeenCalledWith({ where: { categoryId: ID } });
    expect(mock.category.update.mock.calls[0][0].data.deletedAt).toBeInstanceOf(Date);
    expect(mock.auditLog.create.mock.calls[0][0].data.diff).toMatchObject({ detachedTrainings: ["t1", "t2"] });
    expect(revalidate).toHaveBeenCalledWith(expect.arrayContaining(["training:a", "training:b", "category:keuangan"]));
  });

  it("detach: 409 CATEGORY_ONLY_CATEGORY kalau ada pelatihan yang jadi tanpa kategori", async () => {
    mock.category.findFirst.mockResolvedValue(category({ _count: { trainings: 2 } }));
    mock.training.findMany.mockResolvedValue([
      { id: "t1", slug: "a", title: "A", categories: [] },
      { id: "t2", slug: "b", title: "B", categories: [{ categoryId: "lain" }] },
    ]);
    await expect(deleteCategory(ID, "u1", { detach: true })).rejects.toMatchObject({
      status: 409,
      code: "CATEGORY_ONLY_CATEGORY",
      details: { trainings: [{ id: "t1", title: "A" }], total: 1 },
    });
    expect(mock.trainingCategory.deleteMany).not.toHaveBeenCalled();
    expect(mock.category.update).not.toHaveBeenCalled();
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
      createCategory(createInput({ name: "Keuangan", imageId: IMAGE_ID }), "u1"),
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
      summary: null,
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
    // Kategori tanpa pelatihan tayang tidak ikut (filter di query).
    expect(mock.category.findMany.mock.calls[0][0].where).toEqual({
      deletedAt: null,
      trainings: { some: { training: { deletedAt: null, status: "PUBLISHED", publishedAt: { lte: now } } } },
    });
  });
});



describe("getPublicCategory (landing v2)", () => {
  const now = new Date("2026-10-10T00:00:00Z");

  it("null kalau kategori tidak ada / tanpa pelatihan tayang", async () => {
    mock.category.findFirst.mockResolvedValue(null);
    expect(await getPublicCategory("tidak-ada", now)).toBeNull();
  });

  it("metaDescription pakai summary; paragraf dipecah per baris kosong; trainings A-Z", async () => {
    mock.category.findFirst.mockResolvedValue(
      category({
        summary: "Ringkasan kategori.",
        description: "Paragraf satu.\n\nParagraf dua.",
        audience: [{ label: "Staf", trainingCount: 3 }],
        audienceSource: "auto",
        images: [],
        _count: { trainings: 2 },
      }),
    );
    mock.training.findMany.mockResolvedValue([
      { slug: "a", title: "Aaa", types: ["PUBLIC"] },
      { slug: "b", title: "Bbb", types: ["IN_HOUSE"] },
    ]);

    const detail = await getPublicCategory("keuangan", now);
    expect(detail?.metaDescription).toBe("Ringkasan kategori.");
    expect(detail?.descriptionParagraphs).toEqual(["Paragraf satu.", "Paragraf dua."]);
    expect(detail?.audience).toEqual([{ label: "Staf", trainingCount: 3 }]);
    expect(detail?.audienceSource).toBe("auto");
    expect(detail?.trainings).toEqual([
      { slug: "a", title: "Aaa", types: ["PUBLIC"] },
      { slug: "b", title: "Bbb", types: ["IN_HOUSE"] },
    ]);
    // Hanya pelatihan tayang, difilter di query.
    expect(mock.training.findMany.mock.calls[0][0].where).toMatchObject({
      deletedAt: null,
      status: "PUBLISHED",
      publishedAt: { lte: now },
    });
  });

  it("metaDescription jatuh ke 160 karakter pertama description kalau summary kosong", async () => {
    const long = "Kata ".repeat(60).trim(); // > 160 karakter
    mock.category.findFirst.mockResolvedValue(
      category({ summary: null, description: long, images: [], _count: { trainings: 1 } }),
    );
    mock.training.findMany.mockResolvedValue([]);
    const detail = await getPublicCategory("keuangan", now);
    expect(detail?.metaDescription.length).toBeLessThanOrEqual(160);
    expect(detail?.metaDescription.length).toBeGreaterThan(0);
  });

  it("coverAlt: pakai coverAlt kalau ada, lalu alt media; galeri buang media di Sampah", async () => {
    mock.category.findFirst.mockResolvedValue(
      category({
        coverAlt: "Alt khusus",
        image: imageMedia(),
        images: [
          { mediaId: "g1", order: 0, media: imageMedia({ id: "g1", path: "2026/10/g1.webp" }) },
          { mediaId: "g2", order: 1, media: imageMedia({ id: "g2", deletedAt: new Date() }) },
        ],
        _count: { trainings: 1 },
      }),
    );
    mock.training.findMany.mockResolvedValue([]);
    const detail = await getPublicCategory("keuangan", now);
    expect(detail?.coverAlt).toBe("Alt khusus");
    expect(detail?.images).toHaveLength(1);
  });
});


describe("audienceSource invariant (badge 'Dirangkum dari')", () => {
  it("normalizeAudienceSource: audience kosong selalu manual; auto hanya kalau ada isinya", () => {
    expect(normalizeAudienceSource([], "auto")).toBe("manual");
    expect(normalizeAudienceSource([], "manual")).toBe("manual");
    expect(normalizeAudienceSource([{ label: "Staf", trainingCount: null }], "auto")).toBe("auto");
    expect(normalizeAudienceSource([{ label: "Staf", trainingCount: null }], "manual")).toBe("manual");
  });

  it("createCategory: audience kosong + source auto disimpan sebagai manual", async () => {
    mock.category.findFirst.mockResolvedValue(null);
    mock.category.aggregate.mockResolvedValue({ _max: { order: 0 } });
    mock.category.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) =>
      category({ ...data, images: [] }),
    );
    mock.auditLog.create.mockResolvedValue({});

    await createCategory(createInput({ name: "Kosong", audience: [], audienceSource: "auto" }), "u1");
    expect(mock.category.create.mock.calls[0][0].data.audienceSource).toBe("manual");
  });

  it("updateCategory: mengosongkan audience memaksa source kembali manual", async () => {
    mock.category.findFirst.mockResolvedValueOnce(
      category({ audience: [{ label: "Staf", trainingCount: 3 }], audienceSource: "auto" }),
    );
    mock.category.update.mockResolvedValue(category());
    mock.auditLog.create.mockResolvedValue({});

    await updateCategory(ID, { audience: [] }, "u1");
    expect(mock.category.update.mock.calls[0][0].data.audienceSource).toBe("manual");
  });

  it("updateCategory: audience terisi + source auto tetap auto", async () => {
    mock.category.findFirst.mockResolvedValueOnce(category({ audienceSource: "manual" }));
    mock.category.update.mockResolvedValue(category());
    mock.auditLog.create.mockResolvedValue({});

    await updateCategory(ID, { audience: [{ label: "Staf", trainingCount: 2 }], audienceSource: "auto" }, "u1");
    expect(mock.category.update.mock.calls[0][0].data.audienceSource).toBe("auto");
  });
});

describe("listPublicCategoryGrid (/pelatihan)", () => {
  const now = new Date("2026-11-05T00:00:00Z");
  const gridRow = (name: string, extra: Record<string, unknown> = {}) => ({
    slug: name.toLowerCase().replace(/\s+/g, "-"),
    name,
    featured: false,
    image: null,
    images: [],
    _count: { trainings: 2 },
    ...extra,
  });
  const parse = (raw: Record<string, string>) => publicCategoryGridQuerySchema.parse(raw);

  it("nama A-Z murni (localeCompare id, tanpa beda huruf besar); unggulan tidak didahulukan", async () => {
    mock.category.findMany.mockResolvedValue([
      gridRow("zeta"),
      gridRow("Beta"),
      gridRow("Omega", { featured: true }),
      gridRow("alpha"),
      gridRow("Delta", { featured: true }),
    ]);
    const { items } = await listPublicCategoryGrid(parse({ page: "1" }), now);
    expect(items.map((item) => item.name)).toEqual(["alpha", "Beta", "Delta", "Omega", "zeta"]);
    expect(items[2]).toEqual({ slug: "delta", name: "Delta", featured: true, trainingCount: 2, cover: null });
  });

  it("q mencocokkan nama case-insensitive, hanya kategori publik", async () => {
    mock.category.findMany.mockResolvedValue([]);
    await listPublicCategoryGrid(parse({ q: "  Pajak  " }), now);
    const where = mock.category.findMany.mock.calls[0][0].where;
    expect(where.name).toEqual({ contains: "Pajak", mode: "insensitive" });
    expect(where).toMatchObject({ deletedAt: null, trainings: { some: { training: { status: "PUBLISHED", publishedAt: { lte: now } } } } });
    // Tanpa q: tidak ada filter nama.
    await listPublicCategoryGrid(parse({ page: "1" }), now);
    expect(mock.category.findMany.mock.calls[1][0].where.name).toBeUndefined();
  });

  it("cover: Category.image, lalu foto pertama galeri, lalu null; media di Sampah dilewati", async () => {
    mock.category.findMany.mockResolvedValue([
      gridRow("A image", { image: imageMedia() }),
      gridRow("B galeri", { images: [{ mediaId: "g1", order: 0, media: imageMedia({ id: "g1", path: "2026/10/galeri.webp", alt: "Galeri" }) }] }),
      gridRow("C sampah", { image: imageMedia({ deletedAt: new Date() }), images: [] }),
      gridRow("D kosong"),
    ]);
    const { items } = await listPublicCategoryGrid(parse({ page: "1" }), now);
    expect(items[0].cover).toMatchObject({ url: "/uploads/2026/10/kategori.webp", alt: "Kelas keuangan" });
    expect(items[1].cover).toMatchObject({ url: "/uploads/2026/10/galeri.webp", alt: "Galeri" });
    expect(items[2].cover).toBeNull();
    expect(items[3].cover).toBeNull();
    // Galeri: hanya foto pertama yang aktif, urut order.
    expect(mock.category.findMany.mock.calls[0][0].select.images).toMatchObject({
      where: { media: { deletedAt: null } },
      orderBy: { order: "asc" },
      take: 1,
    });
  });

  it("24 per halaman; meta page/pageSize/total/totalPages; page di luar batas -> halaman terakhir", async () => {
    const names = Array.from({ length: 50 }, (_, index) => `Kategori ${String(index).padStart(2, "0")}`);
    mock.category.findMany.mockResolvedValue(names.map((name) => gridRow(name)));
    const second = await listPublicCategoryGrid(parse({ page: "2" }), now);
    expect(second.meta).toEqual({ page: 2, pageSize: 24, total: 50, totalPages: 3 });
    expect(second.items).toHaveLength(24);
    expect(second.items[0].name).toBe("Kategori 24");

    mock.category.findMany.mockResolvedValue(names.map((name) => gridRow(name)));
    const beyond = await listPublicCategoryGrid(parse({ page: "99" }), now);
    expect(beyond.meta.page).toBe(3);
    expect(beyond.items.map((item) => item.name)).toEqual(["Kategori 48", "Kategori 49"]);

    mock.category.findMany.mockResolvedValue([]);
    const empty = await listPublicCategoryGrid(parse({ q: "tidak-ada" }), now);
    expect(empty).toEqual({ items: [], meta: { page: 1, pageSize: 24, total: 0, totalPages: 1 } });
  });

  it("query tak valid tidak error: page bukan angka -> 1, q kosong -> tanpa filter", () => {
    expect(parse({ page: "abc", q: "   " })).toEqual({ page: 1, q: undefined, huruf: undefined });
    expect(parse({ page: "-3" })).toEqual({ page: 1, q: undefined, huruf: undefined });
  });

  it("huruf: satu huruf A-Z (huruf kecil diterima) atau #; nilai lain diabaikan", () => {
    expect(parse({ huruf: "a" }).huruf).toBe("A");
    expect(parse({ huruf: " Z " }).huruf).toBe("Z");
    expect(parse({ huruf: "#" }).huruf).toBe("#");
    for (const huruf of ["", "AB", "1", "é", "?"]) expect(parse({ huruf }).huruf).toBeUndefined();
  });

  it("categoryIndexLetter: huruf awal tanpa aksen, angka/simbol -> #", () => {
    expect(categoryIndexLetter("accounting")).toBe("A");
    expect(categoryIndexLetter("  Émail Marketing")).toBe("E");
    expect(categoryIndexLetter("K3 Umum")).toBe("K");
    expect(categoryIndexLetter("3D Printing")).toBe("#");
    expect(categoryIndexLetter("(Umum)")).toBe("#");
  });

  it("huruf menyaring huruf awal nama (tanpa beda besar/kecil & aksen), urutan & paginasi tetap", async () => {
    mock.category.findMany.mockResolvedValue([
      gridRow("Banking"),
      gridRow("audit"),
      gridRow("Ékonomi"),
      gridRow("Accounting", { featured: true }),
      gridRow("3D Printing"),
      gridRow("energy"),
    ]);
    const a = await listPublicCategoryGrid(parse({ huruf: "a" }), now);
    expect(a.items.map((item) => item.name)).toEqual(["Accounting", "audit"]);
    expect(a.meta).toEqual({ page: 1, pageSize: 24, total: 2, totalPages: 1 });
    // Filter huruf di service (bukan where DB), jadi where tetap hanya kategori publik.
    expect(mock.category.findMany.mock.calls[0][0].where.name).toBeUndefined();

    const e = await listPublicCategoryGrid(parse({ huruf: "E" }), now);
    expect(e.items.map((item) => item.name)).toEqual(["Ékonomi", "energy"]);
    const other = await listPublicCategoryGrid(parse({ huruf: "#" }), now);
    expect(other.items.map((item) => item.name)).toEqual(["3D Printing"]);
    const none = await listPublicCategoryGrid(parse({ huruf: "Q", page: "3" }), now);
    expect(none).toEqual({ items: [], meta: { page: 1, pageSize: 24, total: 0, totalPages: 1 } });
  });
});
