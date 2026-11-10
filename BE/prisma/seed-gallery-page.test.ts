import { beforeEach, describe, expect, it, vi } from "vitest";
import { pageBlocksSchema } from "../src/lib/validators/page-blocks";
import { createMockDb, type MockDb } from "../src/test/mock-db";

const db = vi.hoisted(() => ({ current: undefined as unknown }));
vi.mock("../src/lib/db", () => ({ getDb: () => db.current }));
vi.mock("../src/lib/revalidate", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/lib/revalidate")>()),
  revalidateTags: vi.fn(async () => true),
}));

const { pickGalleryPhotos, seedGalleryPage } = await import("./seed-gallery-page");

const PUBLISHED_AT = new Date("2026-11-10T00:00:00Z");
const mediaId = (n: number) => `0199b4d0-0000-7000-8000-${String(n).padStart(12, "0")}`;
const photos = (count: number) => Array.from({ length: count }, (_, i) => ({ id: mediaId(i + 1), alt: `Foto kegiatan ${i + 1}` }));

let mock: MockDb;
beforeEach(() => {
  mock = createMockDb();
  db.current = mock;
  mock.page.count.mockResolvedValue(0);
  mock.navItem.count.mockResolvedValue(0);
  mock.media.findMany.mockResolvedValue(photos(15));
  mock.page.create.mockResolvedValue({});
  mock.navItem.create.mockResolvedValue({});
  mock.navItem.updateMany.mockResolvedValue({ count: 3 });
});

describe("seedGalleryPage", () => {
  it("slug galeri sudah pernah ada (termasuk Sampah): tidak membuat apa pun", async () => {
    mock.page.count.mockResolvedValue(1);
    expect(await seedGalleryPage(PUBLISHED_AT, true)).toEqual({ page: "exists", menu: "skipped" });
    expect(mock.page.create).not.toHaveBeenCalled();
    expect(mock.navItem.create).not.toHaveBeenCalled();
  });

  it("database baru: tayang dengan 12 foto, menu Galeri disisipkan setelah Artikel", async () => {
    mock.navItem.findFirst.mockImplementation(async ({ where }) => (where.href === "/artikel" ? { order: 3 } : { order: 6 }));

    expect(await seedGalleryPage(PUBLISHED_AT, true)).toEqual({ page: "published", menu: "created" });
    const data = mock.page.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ slug: "galeri", title: "Galeri", status: "PUBLISHED", publishedAt: PUBLISHED_AT });
    const [block] = pageBlocksSchema.parse(data.blocks);
    expect(block?.type === "GALLERY" ? block.images : []).toHaveLength(12);
    expect(mock.navItem.updateMany.mock.calls[0][0]).toMatchObject({ where: { order: { gte: 4 } }, data: { order: { increment: 1 } } });
    expect(mock.navItem.create.mock.calls[0][0].data).toMatchObject({ location: "HEADER", label: "Galeri", href: "/galeri", order: 4 });
  });

  it("database yang sudah berisi (produksi): halaman DRAFT tanpa menu", async () => {
    expect(await seedGalleryPage(PUBLISHED_AT, false)).toEqual({ page: "draft", menu: "skipped" });
    expect(mock.page.create.mock.calls[0][0].data).toMatchObject({ status: "DRAFT", publishedAt: null });
    expect(mock.navItem.create).not.toHaveBeenCalled();
    expect(mock.navItem.updateMany).not.toHaveBeenCalled();
  });

  it("foto kurang dari 2: halaman tidak dibuat", async () => {
    mock.media.findMany.mockResolvedValue(photos(1));
    expect(await seedGalleryPage(PUBLISHED_AT, true)).toEqual({ page: "no-photos", menu: "skipped" });
    expect(mock.page.create).not.toHaveBeenCalled();
  });
});

describe("pickGalleryPhotos", () => {
  it("urutan tetap, alt kosong dilewati, satu foto per alt, maksimal sesuai batas", () => {
    const rows = [
      { id: "a", alt: "Peserta berdiskusi" },
      { id: "b", alt: null },
      { id: "c", alt: "  " },
      { id: "d", alt: "peserta berdiskusi " },
      { id: "e", alt: "Fasilitator memaparkan materi" },
      { id: "f", alt: "Praktik di lapangan" },
    ];
    expect(pickGalleryPhotos(rows, 12)).toEqual(["a", "e", "f"]);
    expect(pickGalleryPhotos(rows, 2)).toEqual(["a", "e"]);
  });
});
