import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockDb, passThroughTransactions, type MockDb } from "@/test/mock-db";

const db = vi.hoisted(() => ({ current: undefined as unknown }));
vi.mock("@/lib/db", () => ({ getDb: () => db.current }));
const revalidate = vi.hoisted(() => vi.fn(async () => true));
vi.mock("@/lib/revalidate", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/revalidate")>()),
  revalidateTags: revalidate,
}));

import {
  createService,
  deleteService,
  getPublicService,
  getServicePreview,
  listPublicServices,
  listServiceOptions,
  restoreService,
  updateService,
} from "@/services/service";

const ID = "0199b4d0-0000-7000-8000-000000000001";

const serviceRow = (extra: Record<string, unknown> = {}) => ({
  id: ID,
  slug: "in-house-training",
  title: "In-house training",
  tagline: null,
  icon: null,
  summary: "Pelatihan di kantor klien.",
  body: null,
  imageId: null,
  image: null,
  benefits: [],
  faqs: [],
  trainingSelection: null,
  order: 0,
  status: "PUBLISHED",
  seo: { title: "", description: "", ogImageId: null },
  createdAt: new Date("2026-10-01T00:00:00Z"),
  updatedAt: new Date("2026-10-02T00:00:00Z"),
  deletedAt: null,
  updatedById: "u0",
  ...extra,
});

let mock: MockDb;

beforeEach(() => {
  mock = createMockDb();
  db.current = mock;
  passThroughTransactions(mock);
  revalidate.mockClear();
  mock.redirect.findFirst.mockResolvedValue(null);
});

describe("createService", () => {
  it("slug dari judul, urutan terakhir + 1, audit; draft tidak me-revalidate", async () => {
    mock.service.findFirst.mockResolvedValue(null);
    mock.service.aggregate.mockResolvedValue({ _max: { order: 2 } });
    mock.service.create.mockImplementation(async ({ data }) => serviceRow({ ...data, id: ID }));

    const created = await createService(
      {
        title: "Public Training",
        slug: undefined,
        icon: null,
        summary: null,
        body: null,
        tagline: null,
        benefits: [],
        faqs: [],
        trainingSelection: null,
        imageId: null,
        status: "DRAFT",
        seo: { title: "", description: "", ogImageId: null },
      },
      "u1",
    );

    expect(mock.service.create.mock.calls[0][0].data).toMatchObject({ slug: "public-training", order: 3, updatedById: "u1" });
    expect(created.slug).toBe("public-training");
    expect(mock.auditLog.create.mock.calls[0][0].data).toMatchObject({ action: "CREATE", entity: "Service" });
    expect(revalidate).not.toHaveBeenCalled();
  });

  it("slug yang ditulis admin dan sudah dipakai: 409", async () => {
    mock.service.findFirst.mockResolvedValue({ id: "lain" });
    await expect(
      createService(
        {
          title: "x",
          slug: "in-house-training",
          icon: null,
          summary: null,
          body: null,
          tagline: null,
          benefits: [],
          faqs: [],
          trainingSelection: null,
          imageId: null,
          status: "PUBLISHED",
          seo: { title: "", description: "", ogImageId: null },
        },
        "u1",
      ),
    ).rejects.toMatchObject({ status: 409, code: "SLUG_TAKEN" });
  });

  it("gambar layanan wajib punya alt", async () => {
    const IMAGE = "0199b4d0-0000-7000-8000-0000000000d1";
    mock.service.findFirst.mockResolvedValue(null);
    mock.media.findMany.mockResolvedValue([{ id: IMAGE, mime: "image/png", alt: null }]);
    await expect(
      createService(
        {
          title: "x",
          slug: undefined,
          icon: null,
          summary: null,
          body: null,
          tagline: null,
          benefits: [],
          faqs: [],
          trainingSelection: null,
          imageId: IMAGE,
          status: "DRAFT",
          seo: { title: "", description: "", ogImageId: null },
        },
        "u1",
      ),
    ).rejects.toMatchObject({
      status: 422,
      fields: { imageId: ["Gambar belum punya teks alt. Isi alt di media library dulu."] },
    });
    expect(mock.service.create).not.toHaveBeenCalled();
  });

  it("tayang langsung: revalidate layanan, beranda, halaman, dan slug", async () => {
    mock.service.findFirst.mockResolvedValue(null);
    mock.service.aggregate.mockResolvedValue({ _max: { order: null } });
    mock.service.create.mockImplementation(async ({ data }) => serviceRow({ ...data }));
    await createService(
      {
        title: "Outbound",
        slug: undefined,
        icon: "users",
        summary: null,
        body: null,
        tagline: null,
        benefits: [],
        faqs: [],
        trainingSelection: null,
        imageId: null,
        status: "PUBLISHED",
        seo: { title: "", description: "", ogImageId: null },
      },
      "u1",
    );
    expect(revalidate).toHaveBeenCalledWith(["services", "home", "pages", "service:outbound"]);
  });
});

// Tabel Redirect di memori, cukup untuk perilaku recordSlugRedirect/releaseRedirectPath.
type RedirectRow = { id: string; from: string; to: string; deletedAt: Date | null };

function useInMemoryRedirects(target: MockDb) {
  const rows: RedirectRow[] = [];
  target.redirect.findFirst.mockImplementation(async ({ where }) =>
    rows.find((row) => row.from === where.from && row.deletedAt === null) ?? null,
  );
  target.redirect.update.mockImplementation(async ({ where, data }) => {
    const row = rows.find((item) => item.id === where.id);
    if (!row) throw new Error("redirect tidak ada");
    if (data.to !== undefined) row.to = data.to;
    if (data.deletedAt !== undefined) row.deletedAt = data.deletedAt;
    return row;
  });
  target.redirect.updateMany.mockImplementation(async ({ where, data }) => {
    for (const row of rows) if (row.to === where.to && row.deletedAt === null) row.to = data.to;
    return { count: 0 };
  });
  target.redirect.create.mockImplementation(async ({ data }) => {
    const row = { id: `r${rows.length + 1}`, from: data.from, to: data.to, deletedAt: null };
    rows.push(row);
    return row;
  });
  return () => rows.filter((row) => row.deletedAt === null).map((row) => `${row.from} -> ${row.to}`).sort();
}

describe("updateService: redirect slug", () => {
  function useServiceState(initial: Record<string, unknown>) {
    let current = serviceRow(initial);
    // findFirst by id = layanan ini; by slug = cek slug bentrok (tidak ada layanan lain).
    mock.service.findFirst.mockImplementation(async ({ where }) => (where.id === ID ? current : null));
    mock.service.update.mockImplementation(async ({ data }) => {
      current = serviceRow({ ...current, ...(data.slug ? { slug: data.slug } : {}) });
      return current;
    });
  }

  const rename = (slug: string) => updateService(ID, { slug }, "u1");

  it("A -> B -> C -> A -> B: tanpa rantai dan tanpa loop", async () => {
    useServiceState({ slug: "a", status: "PUBLISHED" });
    const active = useInMemoryRedirects(mock);

    // Tidak ada redirect yang tujuannya juga sumber redirect lain (rantai), dan slug yang sedang
    // dipakai tidak pernah di-redirect (loop).
    const assertFlat = (currentSlug: string) => {
      const pairs = active().map((line) => line.split(" -> "));
      const froms = new Set(pairs.map(([from]) => from));
      for (const [from, to] of pairs) {
        expect(froms.has(to), `rantai ${from} -> ${to}`).toBe(false);
        expect(from).not.toBe(to);
      }
      expect(froms.has(`/layanan/${currentSlug}`)).toBe(false);
    };

    await rename("b");
    expect(active()).toEqual(["/layanan/a -> /layanan/b"]);
    assertFlat("b");

    await rename("c");
    expect(active()).toEqual(["/layanan/a -> /layanan/c", "/layanan/b -> /layanan/c"]);
    assertFlat("c");

    await rename("a");
    expect(active()).toEqual(["/layanan/b -> /layanan/a", "/layanan/c -> /layanan/a"]);
    assertFlat("a");

    await rename("b");
    expect(active()).toEqual(["/layanan/a -> /layanan/b", "/layanan/c -> /layanan/b"]);
    assertFlat("b");
  });

  it("slug lama + baru di-revalidate", async () => {
    useServiceState({ slug: "a", status: "PUBLISHED" });
    useInMemoryRedirects(mock);
    await rename("b");
    expect(revalidate).toHaveBeenCalledWith(["services", "home", "pages", "service:b", "service:a"]);
  });

  it("layanan draft yang ganti slug: tanpa redirect (URL lama tidak pernah tayang)", async () => {
    useServiceState({ slug: "a", status: "DRAFT" });
    const active = useInMemoryRedirects(mock);
    await rename("b");
    expect(active()).toEqual([]);
    expect(mock.redirect.create).not.toHaveBeenCalled();
  });
});

describe("hapus & pulihkan", () => {
  it("soft delete + audit + revalidate", async () => {
    mock.service.findFirst.mockResolvedValue(serviceRow());
    await deleteService(ID, "u1");
    expect(mock.service.update.mock.calls[0][0].data.deletedAt).toBeInstanceOf(Date);
    expect(mock.auditLog.create.mock.calls[0][0].data).toMatchObject({ action: "DELETE", entityId: ID });
    expect(revalidate).toHaveBeenCalledWith(["services", "home", "pages", "service:in-house-training"]);
  });

  it("pulihkan ke urutan terakhir; tidak ada di Sampah: 404", async () => {
    mock.service.findFirst.mockResolvedValueOnce(null);
    await expect(restoreService(ID, { slug: undefined }, "u1")).rejects.toMatchObject({ status: 404 });

    mock.service.findFirst
      .mockResolvedValueOnce(serviceRow({ deletedAt: new Date() }))
      .mockResolvedValueOnce(null);
    mock.service.aggregate.mockResolvedValue({ _max: { order: 6 } });
    mock.service.update.mockResolvedValue(serviceRow({ order: 7 }));
    await restoreService(ID, { slug: undefined }, "u1");
    expect(mock.service.update.mock.calls[0][0].data).toMatchObject({ deletedAt: null, order: 7 });
  });
});

describe("options", () => {
  it("search + limit, item terpilih di luar hasil tetap ikut", async () => {
    mock.service.findMany
      .mockResolvedValueOnce([serviceRow()])
      .mockResolvedValueOnce([serviceRow({ id: "pilih", title: "Sertifikasi", status: "DRAFT" })]);
    const options = await listServiceOptions({ q: "house", limit: 5, ids: [ID, "pilih"] });
    expect(mock.service.findMany.mock.calls[0][0]).toMatchObject({
      where: { deletedAt: null, title: { contains: "house", mode: "insensitive" } },
      take: 5,
    });
    expect(mock.service.findMany.mock.calls[1][0].where).toEqual({ id: { in: ["pilih"] }, deletedAt: null });
    expect(options).toEqual([
      { id: ID, label: "In-house training", sublabel: null, imageUrl: null },
      { id: "pilih", label: "Sertifikasi", sublabel: "Draf", imageUrl: null },
    ]);
  });
});

describe("publik", () => {
  it("hanya layanan published dan belum dihapus, tanpa field internal", async () => {
    mock.service.findMany.mockResolvedValue([serviceRow()]);
    const [card] = await listPublicServices();
    expect(mock.service.findMany.mock.calls[0][0].where).toEqual({ deletedAt: null, status: "PUBLISHED" });
    expect(Object.keys(card).sort()).toEqual(["icon", "image", "slug", "summary", "tagline", "title"]);
  });

  it("detail: rich text dirender lewat allowlist, tanpa field internal", async () => {
    mock.service.findFirst.mockResolvedValue(
      serviceRow({
        body: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Halo <b>" }] }] },
      }),
    );
    const detail = await getPublicService("in-house-training");
    expect(mock.service.findFirst.mock.calls[0][0].where).toEqual({
      slug: "in-house-training",
      deletedAt: null,
      status: "PUBLISHED",
    });
    expect(detail?.bodyHtml).toBe("<p>Halo &lt;b&gt;</p>");
    expect(Object.keys(detail ?? {}).sort()).toEqual(
      ["benefits", "bodyHtml", "faqs", "icon", "image", "seo", "slug", "summary", "tagline", "title", "trainings", "updatedAt"].sort(),
    );
    // Kolom baru kosong (data lama): section disembunyikan di FE.
    expect(detail).toMatchObject({ tagline: null, benefits: [], faqs: [], trainings: [] });
  });

  it("detail: pelatihan terkait hanya yang tampil publik, urutan pilihan admin dijaga", async () => {
    const [a, b, gone] = ["0199b4d0-0000-7000-8000-00000000000a", "0199b4d0-0000-7000-8000-00000000000b", "0199b4d0-0000-7000-8000-00000000000c"];
    mock.service.findFirst.mockResolvedValue(
      serviceRow({
        tagline: "Kelas khusus instansi",
        benefits: [{ icon: null, title: "Materi disesuaikan", description: "" }, { broken: true }],
        faqs: [{ q: "Minimal peserta?", a: "10 orang." }],
        trainingSelection: { mode: "manual", ids: [b, gone, a] },
      }),
    );
    const card = (id: string, slug: string) => ({
      id,
      slug,
      title: slug,
      summary: null,
      duration: null,
      method: null,
      types: [],
      level: null,
      cover: null,
      categories: [],
      publishedAt: new Date("2026-10-01T00:00:00Z"),
      createdAt: new Date("2026-10-01T00:00:00Z"),
    });
    mock.training.findMany.mockResolvedValue([card(a, "a"), card(b, "b")]);
    const detail = await getPublicService("in-house-training");
    const where = mock.training.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({ id: { in: [b, gone, a] }, deletedAt: null, status: "PUBLISHED" });
    expect(detail?.trainings.map((training) => training.slug)).toEqual(["b", "a"]);
    expect(detail?.tagline).toBe("Kelas khusus instansi");
    // Data rusak dibaca sebagai kosong, bukan error.
    expect(detail?.benefits).toEqual([]);
    expect(detail?.faqs).toEqual([{ q: "Minimal peserta?", a: "10 orang." }]);
  });

  it("pratinjau menyertakan draft tapi tetap filter deletedAt", async () => {
    mock.service.findFirst.mockResolvedValue(serviceRow({ status: "DRAFT" }));
    expect(await getServicePreview("in-house-training")).not.toBeNull();
    expect(mock.service.findFirst.mock.calls[0][0].where).toEqual({ slug: "in-house-training", deletedAt: null });
  });
});
