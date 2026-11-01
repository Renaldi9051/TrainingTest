import { beforeEach, describe, expect, it, vi } from "vitest";
import { articleCreateSchema } from "@/lib/validators/article";
import { createMockDb, passThroughTransactions, type MockDb } from "@/test/mock-db";

const db = vi.hoisted(() => ({ current: undefined as unknown }));
vi.mock("@/lib/db", () => ({ getDb: () => db.current }));
const revalidate = vi.hoisted(() => vi.fn<(tags: string[]) => Promise<boolean>>(async () => true));
vi.mock("@/lib/revalidate", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/revalidate")>()),
  revalidateTags: revalidate,
}));

import {
  bulkArticles,
  createArticle,
  deleteArticle,
  listArticleCalendar,
  listArticles,
  updateArticle,
} from "@/services/article";

const ID = "0199b4d0-0000-7000-8000-000000000001";
const CATEGORY = "0199b4d0-0000-7000-8000-0000000000c1";
const USER = "0199b4d0-0000-7000-8000-0000000000aa";
const now = new Date("2026-11-01T05:00:00.000Z");
const doc = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Isi artikel" }] }] };
const emptyDoc = { type: "doc", content: [] };

function row(extra: Record<string, unknown> = {}) {
  return {
    id: ID,
    slug: "drone-mapping",
    title: "Drone mapping",
    excerpt: null,
    body: emptyDoc,
    coverId: null,
    cover: null,
    authorName: "Tim Media",
    sourceName: null,
    sourceUrl: null,
    categoryId: CATEGORY,
    category: { id: CATEGORY, slug: "teknologi", name: "Teknologi", deletedAt: null },
    status: "DRAFT",
    publishedAt: null,
    publishRevalidatedAt: null,
    seo: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    updatedById: null,
    ...extra,
  };
}

const input = (extra: Record<string, unknown> = {}) =>
  articleCreateSchema.parse({ title: "Drone mapping", authorName: "Tim Media", categoryId: CATEGORY, ...extra });

let mock: MockDb;

beforeEach(() => {
  mock = createMockDb();
  db.current = mock;
  passThroughTransactions(mock);
  revalidate.mockClear();
  mock.articleCategory.count.mockResolvedValue(1);
  mock.article.findFirst.mockResolvedValue(null);
  mock.redirect.findFirst.mockResolvedValue(null);
  mock.media.findMany.mockResolvedValue([]);
});

describe("createArticle", () => {
  it("draf tanpa isi: disimpan dokumen kosong, slug dari judul, tanpa revalidate", async () => {
    mock.article.create.mockImplementation(async ({ data }) => row(data));
    const dto = await createArticle(input(), USER, now);
    const data = mock.article.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ slug: "drone-mapping", body: emptyDoc, status: "DRAFT", publishedAt: null });
    expect(dto.publicState).toBe("DRAFT");
    expect(dto.body).toBeNull();
    expect(revalidate).not.toHaveBeenCalled();
    expect(mock.auditLog.create).toHaveBeenCalled();
  });

  it("tayang tanpa isi ditolak", async () => {
    await expect(createArticle(input({ status: "PUBLISHED" }), USER, now)).rejects.toMatchObject({
      status: 422,
      code: "NOT_PUBLISHABLE",
      fields: { body: ["Isi artikel wajib diisi sebelum ditayangkan."] },
    });
    expect(mock.article.create).not.toHaveBeenCalled();
  });

  it("kategori yang sudah dihapus ditolak", async () => {
    mock.articleCategory.count.mockResolvedValue(0);
    await expect(createArticle(input(), USER, now)).rejects.toMatchObject({ fields: { categoryId: expect.any(Array) } });
  });

  it("publish sekarang: publishedAt = now, langsung revalidate tag artikel", async () => {
    mock.article.create.mockImplementation(async ({ data }) => row(data));
    const dto = await createArticle(input({ status: "PUBLISHED", body: doc }), USER, now);
    expect(mock.article.create.mock.calls[0][0].data).toMatchObject({ publishedAt: now, publishRevalidatedAt: now });
    expect(dto.publicState).toBe("PUBLISHED");
    expect(revalidate).toHaveBeenCalledWith(["articles", "home", "article:drone-mapping"]);
  });

  it("jadwalkan: publishedAt di masa depan = Terjadwal, revalidate menunggu scheduler", async () => {
    mock.article.create.mockImplementation(async ({ data }) => row(data));
    const dto = await createArticle(
      input({ status: "PUBLISHED", body: doc, publishedAt: "2026-11-05T09:00:00+07:00" }),
      USER,
      now,
    );
    expect(mock.article.create.mock.calls[0][0].data).toMatchObject({ publishRevalidatedAt: null });
    expect(dto.publicState).toBe("SCHEDULED");
    expect(revalidate).not.toHaveBeenCalled();
  });
});

describe("updateArticle", () => {
  it("ganti slug artikel tayang: redirect 301 dari URL lama, revalidate slug lama + baru", async () => {
    const before = row({ status: "PUBLISHED", body: doc, publishedAt: now, publishRevalidatedAt: now });
    mock.article.findFirst.mockResolvedValueOnce(before).mockResolvedValue(null);
    mock.article.update.mockImplementation(async ({ data }) => ({ ...before, ...data }));
    mock.redirect.create.mockResolvedValue({ id: "r1" });
    await updateArticle(ID, { slug: "pemetaan-drone" }, USER, now);
    expect(mock.redirect.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ from: "/artikel/drone-mapping", to: "/artikel/pemetaan-drone" }) }),
    );
    expect(revalidate).toHaveBeenCalledWith(["articles", "home", "article:pemetaan-drone", "article:drone-mapping"]);
    // Waktu publish sama: penanda revalidate tidak di-reset.
    expect(mock.article.update.mock.calls[0][0].data).not.toHaveProperty("publishRevalidatedAt");
  });

  it("ubah draf tidak me-revalidate halaman publik", async () => {
    const before = row();
    mock.article.findFirst.mockResolvedValueOnce(before);
    mock.article.update.mockImplementation(async ({ data }) => ({ ...before, ...data }));
    await updateArticle(ID, { title: "Judul baru" }, USER, now);
    expect(revalidate).not.toHaveBeenCalled();
  });

  it("menarik artikel tayang ke draf me-revalidate supaya hilang dari publik", async () => {
    const before = row({ status: "PUBLISHED", body: doc, publishedAt: now, publishRevalidatedAt: now });
    mock.article.findFirst.mockResolvedValueOnce(before);
    mock.article.update.mockImplementation(async ({ data }) => ({ ...before, ...data }));
    await updateArticle(ID, { status: "DRAFT" }, USER, now);
    expect(revalidate).toHaveBeenCalled();
  });
});

describe("bulkArticles", () => {
  it("publish melewati artikel tanpa isi", async () => {
    const other = "0199b4d0-0000-7000-8000-000000000002";
    mock.article.findMany.mockResolvedValue([
      { id: ID, slug: "a", title: "A", body: doc },
      { id: other, slug: "b", title: "B", body: emptyDoc },
    ]);
    const result = await bulkArticles({ action: "publish", ids: [ID, other] }, USER, now);
    expect(result).toEqual({ affected: 1, skipped: [{ id: other, title: "B", reason: expect.any(String) }] });
    expect(mock.article.updateMany).toHaveBeenLastCalledWith({
      where: { id: { in: [ID] } },
      data: { status: "PUBLISHED", publishRevalidatedAt: now, updatedById: USER },
    });
  });

  it("id yang tidak ditemukan menggagalkan seluruh aksi", async () => {
    mock.article.findMany.mockResolvedValue([]);
    await expect(bulkArticles({ action: "delete", ids: [ID] }, USER, now)).rejects.toMatchObject({ status: 422 });
  });
});

describe("listArticles & kalender", () => {
  it("filter Terjadwal = PUBLISHED dengan publishedAt > now; meta berisi jumlah per status", async () => {
    mock.article.findMany.mockResolvedValue([]);
    mock.article.count.mockResolvedValueOnce(0).mockResolvedValueOnce(2).mockResolvedValueOnce(3).mockResolvedValueOnce(4);
    const { meta } = await listArticles(
      { page: 1, pageSize: 20, q: undefined, status: "SCHEDULED", sort: { field: "updatedAt", direction: "desc" } },
      now,
    );
    expect(mock.article.findMany.mock.calls[0][0].where).toMatchObject({
      deletedAt: null,
      status: "PUBLISHED",
      publishedAt: { gt: now },
    });
    expect(meta.counts).toEqual({ ALL: 9, DRAFT: 2, SCHEDULED: 3, PUBLISHED: 4 });
  });

  it("kalender memakai batas bulan WIB", async () => {
    mock.article.findMany.mockResolvedValue([]);
    await listArticleCalendar({ month: "2026-12" }, now);
    expect(mock.article.findMany.mock.calls[0][0].where).toEqual({
      deletedAt: null,
      status: "PUBLISHED",
      publishedAt: { gte: new Date("2026-11-30T17:00:00.000Z"), lt: new Date("2026-12-31T17:00:00.000Z") },
    });
  });
});

describe("deleteArticle", () => {
  it("soft delete; draf tidak me-revalidate", async () => {
    mock.article.findFirst.mockResolvedValue(row());
    await deleteArticle(ID, USER, now);
    expect(mock.article.update).toHaveBeenCalledWith({ where: { id: ID }, data: { deletedAt: now, updatedById: USER } });
    expect(revalidate).not.toHaveBeenCalled();
  });
});
