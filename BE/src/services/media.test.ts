import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockDb, type MockDb } from "@/test/mock-db";

const db = vi.hoisted(() => ({ current: undefined as unknown }));
vi.mock("@/lib/db", () => ({ getDb: () => db.current }));
vi.mock("@/lib/revalidate", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/revalidate")>()),
  revalidateTags: vi.fn(),
}));
const saved = vi.hoisted(() => [] as { path: string; content: string }[]);
vi.mock("@/lib/storage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/storage")>()),
  saveUpload: vi.fn(async (relativePath: string, data: Uint8Array) => {
    saved.push({ path: relativePath, content: new TextDecoder().decode(data) });
  }),
}));

import { assertMediaRefs, deleteMedia, getMediaUsages, toMediaDto, uploadMedia } from "@/services/media";

const media = {
  id: "0199b4d0-0000-7000-8000-000000000001",
  path: "2026/10/a.webp",
  originalName: "a.jpg",
  mime: "image/webp",
  size: 100,
  width: 10,
  height: 10,
  alt: null,
  folder: null,
  variants: { "320": { path: "2026/10/a-320.webp", width: 10, height: 10, size: 50 } },
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  updatedById: null,
};

let mock: MockDb;

function noUsages() {
  for (const model of [
    mock.training,
    mock.category,
    mock.service,
    mock.client,
    mock.testimonial,
    mock.marketingContact,
    mock.portfolioImage,
    mock.trainingImage,
    mock.siteSetting,
    mock.page,
  ]) {
    model.findMany.mockResolvedValue([]);
  }
  mock.$queryRaw.mockResolvedValue([]);
}

beforeEach(() => {
  mock = createMockDb();
  db.current = mock;
  saved.length = 0;
});

describe("toMediaDto", () => {
  it("membentuk URL /uploads untuk file utama dan varian", () => {
    expect(toMediaDto(media)).toMatchObject({
      url: "/uploads/2026/10/a.webp",
      variants: { "320": { url: "/uploads/2026/10/a-320.webp", width: 10, height: 10 } },
    });
  });
});

describe("deleteMedia", () => {
  it("409 MEDIA_IN_USE dengan daftar pemakai kalau masih dipakai", async () => {
    mock.media.findFirst.mockResolvedValue(media);
    noUsages();
    // Panggilan pertama: cover; kedua: SEO (gambar OG).
    mock.training.findMany.mockResolvedValueOnce([
      { id: "t1", title: "Analisis Laporan Keuangan", deletedAt: null },
    ]);
    mock.portfolioImage.findMany.mockResolvedValue([
      { portfolioItem: { id: "p1", title: "Workshop 2025", deletedAt: new Date() } },
    ]);

    await expect(deleteMedia(media.id, "u1")).rejects.toMatchObject({
      status: 409,
      code: "MEDIA_IN_USE",
      details: {
        usages: [
          expect.objectContaining({ entity: "Training", label: "Analisis Laporan Keuangan", inTrash: false }),
          expect.objectContaining({ entity: "PortfolioItem", label: "Workshop 2025", inTrash: true }),
        ],
      },
    });
    expect(mock.media.update).not.toHaveBeenCalled();
  });

  it("gambar di galeri pelatihan dihitung sebagai pemakaian", async () => {
    mock.media.findFirst.mockResolvedValue(media);
    noUsages();
    mock.trainingImage.findMany.mockResolvedValue([{ training: { id: "t3", title: "Audit Internal", deletedAt: null } }]);
    await expect(deleteMedia(media.id, "u1")).rejects.toMatchObject({
      status: 409,
      details: { usages: [expect.objectContaining({ entity: "Training", label: "Audit Internal", field: "Galeri" })] },
    });
  });

  it("ikut menghitung mediaId di pengaturan situs dan SEO pelatihan", async () => {
    mock.media.findFirst.mockResolvedValue(media);
    noUsages();
    mock.training.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: "t2", title: "KPI", deletedAt: null }]);
    mock.siteSetting.findMany.mockResolvedValue([
      { id: "s1", key: "site.identity", value: { name: "X", logoLightId: media.id, faviconId: media.id } },
      { id: "s2", key: "seo.default", value: { ogImageId: "lain" } },
    ]);

    await expect(deleteMedia(media.id, "u1")).rejects.toMatchObject({
      status: 409,
      details: {
        usages: [
          expect.objectContaining({ entity: "Training", id: "t2", field: "Gambar OG" }),
          expect.objectContaining({ entity: "SiteSetting", label: "Identitas situs", field: "Logo terang" }),
          expect.objectContaining({ entity: "SiteSetting", label: "Identitas situs", field: "Favicon" }),
        ],
      },
    });
  });

  it("soft delete + audit kalau tidak dipakai", async () => {
    mock.media.findFirst.mockResolvedValue(media);
    noUsages();
    await deleteMedia(media.id, "u1");
    expect(mock.media.update.mock.calls[0][0].data.deletedAt).toBeInstanceOf(Date);
    expect(mock.auditLog.create.mock.calls[0][0].data).toMatchObject({
      action: "DELETE",
      entity: "Media",
      entityId: media.id,
    });
  });

  it("404 kalau media tidak ada atau sudah dihapus", async () => {
    mock.media.findFirst.mockResolvedValue(null);
    await expect(deleteMedia(media.id, "u1")).rejects.toMatchObject({ status: 404 });
  });
});

describe("getMediaUsages: gambar kategori", () => {
  it("kategori yang memakai media dihitung (termasuk di Sampah), hapus media = 409 MEDIA_IN_USE", async () => {
    mock.media.findFirst.mockResolvedValue(media);
    noUsages();
    mock.category.findMany.mockResolvedValue([
      { id: "c1", name: "Keuangan", deletedAt: null },
      { id: "c2", name: "Arsip", deletedAt: new Date() },
    ]);

    await expect(deleteMedia(media.id, "u1")).rejects.toMatchObject({
      status: 409,
      code: "MEDIA_IN_USE",
      details: {
        usages: [
          { entity: "Category", entityLabel: "Kategori", id: "c1", label: "Keuangan", field: "Gambar", inTrash: false },
          { entity: "Category", entityLabel: "Kategori", id: "c2", label: "Arsip", field: "Gambar", inTrash: true },
        ],
      },
    });
    expect(mock.category.findMany.mock.calls[0][0].where).toEqual({ imageId: media.id });
    expect(mock.media.update).not.toHaveBeenCalled();
  });
});

describe("getMediaUsages: mediaId di JSON beranda & halaman", () => {
  const BLOCK = "0199b4d0-0000-7000-8000-0000000000b1";

  it("section beranda dan blok halaman yang memuat { mediaId } ikut dihitung, termasuk di Sampah", async () => {
    noUsages();
    mock.$queryRaw
      .mockResolvedValueOnce([
        { id: "h1", type: "HERO", title: null, content: { headline: "x", image: { mediaId: media.id } }, deletedAt: null },
      ])
      .mockResolvedValueOnce([
        {
          id: "pg1",
          title: "Profil",
          deletedAt: new Date(),
          blocks: [
            { id: BLOCK, type: "LIST", items: ["a"] },
            { id: BLOCK, type: "DOWNLOAD", label: "Unduh", file: { mediaId: media.id } },
            { id: BLOCK, type: "IMAGE", image: { mediaId: "lain" } },
          ],
        },
      ]);

    expect(await getMediaUsages(media.id)).toEqual([
      { entity: "HomeSection", entityLabel: "Beranda", id: "h1", label: "Hero", field: "Gambar", inTrash: false },
      {
        entity: "Page",
        entityLabel: "Halaman",
        id: "pg1",
        label: "Profil",
        field: "Blok 2 (Unduhan) › File",
        inTrash: true,
      },
    ]);
  });

  it("query JSON memakai parameter: id dan jsonpath tidak digabung ke string SQL", async () => {
    noUsages();
    await getMediaUsages(media.id);
    expect(mock.$queryRaw).toHaveBeenCalledTimes(2);
    for (const [strings, ...values] of mock.$queryRaw.mock.calls as [TemplateStringsArray, ...unknown[]][]) {
      const sql = strings.join("?");
      expect(sql).toContain("jsonb_path_exists");
      expect(sql).toContain("jsonb_build_object('id', ?::text)");
      expect(sql).not.toContain(media.id);
      expect(values).toEqual(["$.**.mediaId ? (@ == $id)", media.id]);
    }
  });

  it("gambar OG layanan dan halaman ikut dihitung", async () => {
    noUsages();
    mock.service.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: "sv1", title: "In-house", deletedAt: null }]);
    mock.page.findMany.mockResolvedValueOnce([{ id: "pg2", title: "Kebijakan privasi", deletedAt: null }]);
    expect(await getMediaUsages(media.id)).toEqual([
      expect.objectContaining({ entity: "Service", id: "sv1", field: "Gambar OG" }),
      expect.objectContaining({ entity: "Page", id: "pg2", field: "Gambar OG" }),
    ]);
  });

  it("hapus media yang dipakai section beranda: 409", async () => {
    mock.media.findFirst.mockResolvedValue(media);
    noUsages();
    mock.$queryRaw.mockResolvedValueOnce([
      { id: "h1", type: "HERO", title: "Utama", content: { image: { mediaId: media.id } }, deletedAt: null },
    ]);
    await expect(deleteMedia(media.id, "u1")).rejects.toMatchObject({
      status: 409,
      code: "MEDIA_IN_USE",
      details: { usages: [expect.objectContaining({ entity: "HomeSection", label: "Hero (Utama)" })] },
    });
    expect(mock.media.update).not.toHaveBeenCalled();
  });
});

describe("assertMediaRefs", () => {
  it("gambar harus image/*, PDF harus application/pdf; error per path field", async () => {
    mock.media.findMany.mockResolvedValue([
      { id: "img", mime: "image/webp" },
      { id: "pdf", mime: "application/pdf" },
    ]);
    await expect(
      assertMediaRefs([
        { field: "blocks.0.image", mediaId: "img", kind: "image" },
        { field: "blocks.1.file", mediaId: "img", kind: "pdf" },
        { field: "blocks.2.image", mediaId: "pdf", kind: "image" },
        { field: "blocks.3.file", mediaId: "hilang", kind: "pdf" },
        { field: "blocks.4.file", mediaId: null, kind: "pdf" },
      ]),
    ).rejects.toMatchObject({
      status: 422,
      fields: {
        "blocks.1.file": ["File PDF tidak ditemukan atau sudah dihapus."],
        "blocks.2.image": ["Gambar tidak ditemukan atau sudah dihapus."],
        "blocks.3.file": ["File PDF tidak ditemukan atau sudah dihapus."],
      },
    });
    expect(mock.media.findMany.mock.calls[0][0].where).toMatchObject({ deletedAt: null });
  });

  it("tanpa referensi: tidak query", async () => {
    await assertMediaRefs([{ field: "image", mediaId: null, kind: "image" }]);
    expect(mock.media.findMany).not.toHaveBeenCalled();
  });
});

describe("uploadMedia", () => {
  it("file palsu (.jpg berisi teks) gagal per file, tanpa menulis ke disk atau DB", async () => {
    const result = await uploadMedia(
      [{ name: "foto.jpg", data: new TextEncoder().encode("bukan gambar") }],
      { folder: null, userId: "u1" },
    );
    expect(result.created).toHaveLength(0);
    expect(result.failed).toEqual([
      { name: "foto.jpg", code: "UNSUPPORTED_TYPE", message: expect.any(String) },
    ]);
    expect(saved).toHaveLength(0);
    expect(mock.media.create).not.toHaveBeenCalled();
  });

  it("SVG disanitasi sebelum disimpan", async () => {
    mock.media.create.mockImplementation(async ({ data }) => ({ ...media, ...data, id: media.id }));
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><script>alert(1)</script></svg>';
    const result = await uploadMedia([{ name: "logo.svg", data: new TextEncoder().encode(svg) }], {
      folder: "logo",
      userId: "u1",
    });
    expect(result.failed).toEqual([]);
    expect(saved).toHaveLength(1);
    expect(saved[0].path).toMatch(/^\d{4}\/\d{2}\/[0-9a-f-]{36}\.svg$/);
    expect(saved[0].content).toMatch(/^<svg/);
    expect(saved[0].content).not.toMatch(/<script/i);
    const data = mock.media.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ mime: "image/svg+xml", folder: "logo", originalName: "logo.svg" });
  });
});
