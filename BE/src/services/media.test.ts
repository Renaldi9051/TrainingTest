import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockDb, type MockDb } from "@/test/mock-db";

const db = vi.hoisted(() => ({ current: undefined as unknown }));
vi.mock("@/lib/db", () => ({ getDb: () => db.current }));
vi.mock("@/lib/revalidate", () => ({
  RevalidateTag: { MEDIA: "media" },
  revalidateTags: vi.fn(),
}));
const saved = vi.hoisted(() => [] as { path: string; content: string }[]);
vi.mock("@/lib/storage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/storage")>()),
  saveUpload: vi.fn(async (relativePath: string, data: Uint8Array) => {
    saved.push({ path: relativePath, content: new TextDecoder().decode(data) });
  }),
}));

import { deleteMedia, toMediaDto, uploadMedia } from "@/services/media";

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
    mock.service,
    mock.client,
    mock.testimonial,
    mock.marketingContact,
    mock.portfolioImage,
    mock.siteSetting,
  ]) {
    model.findMany.mockResolvedValue([]);
  }
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
