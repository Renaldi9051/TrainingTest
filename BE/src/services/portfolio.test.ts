import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockDb, passThroughTransactions, type MockDb } from "@/test/mock-db";

const db = vi.hoisted(() => ({ current: undefined as unknown }));
vi.mock("@/lib/db", () => ({ getDb: () => db.current }));
const revalidate = vi.hoisted(() => vi.fn(async () => true));
vi.mock("@/lib/revalidate", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/revalidate")>()),
  revalidateTags: revalidate,
}));

import { createPortfolio, listPublicPortfolio, updatePortfolio } from "@/services/portfolio";

const ID = "0199b4d0-0000-7000-8000-000000000001";
const img = (n: number) => `0199b4d0-0000-7000-8000-0000000000${String(n).padStart(2, "0")}`;

const media = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  path: `2026/10/${id}.webp`,
  originalName: null,
  mime: "image/webp",
  size: 1,
  width: 800,
  height: 600,
  alt: "Peserta workshop",
  folder: null,
  variants: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  updatedById: null,
  ...extra,
});

const item = (images: ReturnType<typeof media>[] = [], extra: Record<string, unknown> = {}) => ({
  id: ID,
  title: "Workshop KPI 2026",
  date: new Date("2026-03-01T00:00:00Z"),
  client: "PT Contoh",
  description: null,
  order: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  updatedById: null,
  images: images.map((m, order) => ({ portfolioItemId: ID, mediaId: m.id, order, media: m })),
  ...extra,
});

let mock: MockDb;

beforeEach(() => {
  mock = createMockDb();
  db.current = mock;
  passThroughTransactions(mock);
  revalidate.mockClear();
});

const input = (imageIds: string[]) => ({
  activityType: null,
  title: "Workshop KPI 2026",
  date: "2026-03-01",
  client: "PT Contoh",
  description: null,
  imageIds,
});

describe("galeri portofolio", () => {
  it("setiap gambar wajib media gambar aktif dengan alt; error per index", async () => {
    mock.media.findMany.mockResolvedValue([
      { id: img(1), mime: "image/webp", alt: "Sesi pembukaan" },
      { id: img(2), mime: "image/webp", alt: "  " },
      { id: img(3), mime: "application/pdf", alt: "Brosur" },
      { id: img(5), mime: "image/png", alt: null },
    ]);

    await expect(createPortfolio(input([img(1), img(2), img(3), img(4), img(5)]), "u1")).rejects.toMatchObject({
      status: 422,
      fields: {
        "imageIds.1": ["Gambar belum punya teks alt. Isi alt di media library dulu."],
        "imageIds.2": ["Gambar tidak ditemukan atau sudah dihapus."],
        "imageIds.3": ["Gambar tidak ditemukan atau sudah dihapus."],
        "imageIds.4": ["Gambar belum punya teks alt. Isi alt di media library dulu."],
      },
    });
    expect(mock.media.findMany.mock.calls[0][0].where).toMatchObject({ deletedAt: null });
    expect(mock.portfolioItem.create).not.toHaveBeenCalled();
  });

  it("create: galeri dibuat sesuai urutan imageIds, tanggal disimpan sebagai date", async () => {
    mock.media.findMany.mockResolvedValue([
      { id: img(1), mime: "image/webp", alt: "a" },
      { id: img(2), mime: "image/webp", alt: "b" },
    ]);
    mock.portfolioItem.aggregate.mockResolvedValue({ _max: { order: 0 } });
    mock.portfolioItem.create.mockResolvedValue(item([media(img(2)), media(img(1))]));

    const created = await createPortfolio(input([img(2), img(1)]), "u1");
    const data = mock.portfolioItem.create.mock.calls[0][0].data;
    expect(data.images.create).toEqual([
      { mediaId: img(2), order: 0 },
      { mediaId: img(1), order: 1 },
    ]);
    expect(data.date).toEqual(new Date("2026-03-01T00:00:00.000Z"));
    expect(data.order).toBe(1);
    expect(created.imageIds).toEqual([img(2), img(1)]);
    expect(revalidate).toHaveBeenCalledWith(["portfolio"]);
  });

  it("update imageIds: galeri diganti utuh dalam transaksi yang sama", async () => {
    mock.portfolioItem.findFirst.mockResolvedValue(item([media(img(1))]));
    mock.media.findMany.mockResolvedValue([{ id: img(3), mime: "image/webp", alt: "c" }]);
    mock.portfolioItem.update.mockResolvedValue(item([media(img(3))]));

    await updatePortfolio(ID, { imageIds: [img(3)] }, "u1");
    expect(mock.portfolioImage.deleteMany).toHaveBeenCalledWith({ where: { portfolioItemId: ID } });
    expect(mock.portfolioImage.createMany).toHaveBeenCalledWith({
      data: [{ portfolioItemId: ID, mediaId: img(3), order: 0 }],
    });
    expect(mock.auditLog.create.mock.calls[0][0].data.diff).toMatchObject({
      imageIds: { from: [img(1)], to: [img(3)] },
    });
  });

  it("update tanpa imageIds tidak menyentuh galeri", async () => {
    mock.portfolioItem.findFirst.mockResolvedValue(item());
    mock.portfolioItem.update.mockResolvedValue(item([], { title: "Baru" }));
    await updatePortfolio(ID, { title: "Baru" }, "u1");
    expect(mock.portfolioImage.deleteMany).not.toHaveBeenCalled();
    expect(mock.media.findMany).not.toHaveBeenCalled();
  });
});

describe("publik", () => {
  it("gambar di Sampah dilewati; tanpa field internal", async () => {
    mock.portfolioItem.findMany.mockResolvedValue([item([media(img(1)), media(img(2), { deletedAt: new Date() })])]);
    const [entry] = await listPublicPortfolio();
    expect(mock.portfolioItem.findMany.mock.calls[0][0].where).toEqual({ deletedAt: null });
    expect(Object.keys(entry).sort()).toEqual(["activityType", "client", "date", "description", "images", "title"]);
    expect(entry.date).toBe("2026-03-01");
    expect(entry.images).toHaveLength(1);
    expect(Object.keys(entry.images[0]).sort()).toEqual(["alt", "height", "mime", "url", "variants", "width"]);
  });
});
