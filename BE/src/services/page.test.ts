import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockDb, passThroughTransactions, type MockDb } from "@/test/mock-db";

const db = vi.hoisted(() => ({ current: undefined as unknown }));
vi.mock("@/lib/db", () => ({ getDb: () => db.current }));
const revalidate = vi.hoisted(() => vi.fn(async () => true));
vi.mock("@/lib/revalidate", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/revalidate")>()),
  revalidateTags: revalidate,
}));

import { pageCreateSchema, pageUpdateSchema } from "@/lib/validators/page";
import {
  createPage,
  deletePage,
  getPublicPage,
  listPublicPages,
  resolvePageBlocks,
  updatePage,
} from "@/services/page";

const ID = "0199b4d0-0000-7000-8000-000000000001";
const block = (n: number) => `0199b4d0-0000-7000-8000-0000000b${String(n).padStart(4, "0")}`;
const IMG = "0199b4d0-0000-7000-8000-0000000000aa";
const PDF = "0199b4d0-0000-7000-8000-0000000000bb";
const SVC_A = "0199b4d0-0000-7000-8000-0000000000c1";
const SVC_B = "0199b4d0-0000-7000-8000-0000000000c2";
const now = new Date("2026-10-12T03:00:00Z");

const pageRow = (extra: Record<string, unknown> = {}) => ({
  id: ID,
  kind: "STANDARD",
  slug: "kebijakan-privasi",
  title: "Kebijakan privasi",
  blocks: [],
  status: "DRAFT",
  seo: null,
  publishedAt: null,
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
  updatedById: null,
  ...extra,
});

const mediaRow = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  path: `2026/10/${id}.webp`,
  originalName: null,
  mime: "image/webp",
  size: 100,
  width: 800,
  height: 600,
  alt: "Alt",
  folder: null,
  variants: null,
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
  updatedById: null,
  ...extra,
});

const serviceRow = (id: string, title: string) => ({
  id,
  slug: title.toLowerCase().replace(/\s+/g, "-"),
  title,
  icon: null,
  summary: null,
  body: null,
  imageId: null,
  image: null,
  order: 0,
  status: "PUBLISHED",
  seo: null,
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
  updatedById: null,
});

let mock: MockDb;

beforeEach(() => {
  mock = createMockDb();
  db.current = mock;
  passThroughTransactions(mock);
  revalidate.mockClear();
  mock.redirect.findFirst.mockResolvedValue(null);
  mock.page.findFirst.mockResolvedValue(null);
  mock.media.findMany.mockResolvedValue([]);
  mock.page.create.mockImplementation(async ({ data }) => pageRow(data));
  mock.page.update.mockImplementation(async ({ data }) => pageRow(data));
});

describe("createPage", () => {
  it("slug otomatis melewati slug route situs (Kontak -> kontak-2)", async () => {
    const created = await createPage(pageCreateSchema.parse({ title: "Kontak" }), "u1", now);
    expect(created.slug).toBe("kontak-2");
    expect(mock.page.create.mock.calls[0][0].data).toMatchObject({ kind: "STANDARD", slug: "kontak-2" });
  });

  it.each(["profil", "layanan", "admin"])("slug %s yang ditulis admin ditolak 422", async (slug) => {
    await expect(createPage(pageCreateSchema.parse({ title: "x", slug }), "u1", now)).rejects.toMatchObject({
      status: 422,
      fields: { slug: ["Slug ini dipakai halaman lain di situs. Ganti dengan slug lain."] },
    });
    expect(mock.page.create).not.toHaveBeenCalled();
  });

  it("tayang: publishedAt diisi, revalidate pages + page:slug", async () => {
    await createPage(pageCreateSchema.parse({ title: "Syarat", status: "PUBLISHED" }), "u1", now);
    expect(mock.page.create.mock.calls[0][0].data.publishedAt).toEqual(now);
    expect(revalidate).toHaveBeenCalledWith(["pages", "page:syarat"]);
  });

  it("media di blok divalidasi per field (blocks.N.image wajib alt, blocks.N.file wajib PDF)", async () => {
    mock.media.findMany.mockResolvedValue([
      { id: IMG, mime: "image/webp", alt: null },
      { id: PDF, mime: "image/png", alt: "x" },
    ]);
    const input = pageCreateSchema.parse({
      title: "x",
      blocks: [
        { id: block(1), type: "LIST", items: ["a"] },
        { id: block(2), type: "IMAGE", image: { mediaId: IMG } },
        { id: block(3), type: "DOWNLOAD", label: "Unduh", file: { mediaId: PDF } },
      ],
    });
    await expect(createPage(input, "u1", now)).rejects.toMatchObject({
      status: 422,
      fields: {
        "blocks.1.image": ["Gambar belum punya teks alt. Isi alt di media library dulu."],
        "blocks.2.file": ["File PDF tidak ditemukan atau sudah dihapus."],
      },
    });
  });
});

describe("updatePage: halaman sistem PROFILE", () => {
  beforeEach(() => {
    mock.page.findFirst.mockImplementation(async ({ where }) =>
      where.id === ID ? pageRow({ kind: "PROFILE", slug: "profil", status: "PUBLISHED" }) : null,
    );
    mock.page.update.mockImplementation(async ({ data }) => pageRow({ kind: "PROFILE", slug: "profil", ...data }));
  });

  it("slug selain profil ditolak 422, bukan diabaikan", async () => {
    await expect(updatePage(ID, pageUpdateSchema.parse({ slug: "tentang-kami" }), "u1", now)).rejects.toMatchObject({
      status: 422,
      fields: { slug: ["Slug halaman profil tidak bisa diubah."] },
    });
    expect(mock.page.update).not.toHaveBeenCalled();
  });

  it("slug profil yang sama tetap boleh dikirim (form mengirim ulang slug)", async () => {
    await updatePage(ID, pageUpdateSchema.parse({ slug: "profil", title: "Tentang kami" }), "u1", now);
    expect(mock.page.update.mock.calls[0][0].data).not.toHaveProperty("slug");
    expect(revalidate).toHaveBeenCalledWith(["pages", "page:profil"]);
  });

  it("DELETE halaman profil: 409", async () => {
    await expect(deletePage(ID, "u1")).rejects.toMatchObject({ status: 409, code: "SYSTEM_PAGE" });
    expect(mock.page.update).not.toHaveBeenCalled();
  });
});

describe("updatePage: halaman biasa", () => {
  it("pindah ke slug route situs ditolak 422", async () => {
    mock.page.findFirst.mockImplementation(async ({ where }) => (where.id === ID ? pageRow() : null));
    await expect(updatePage(ID, pageUpdateSchema.parse({ slug: "jadwal" }), "u1", now)).rejects.toMatchObject({
      status: 422,
    });
  });

  it("slug halaman tayang berubah: redirect 301 dicatat, slug lama + baru di-revalidate", async () => {
    mock.page.findFirst.mockImplementation(async ({ where }) =>
      where.id === ID ? pageRow({ status: "PUBLISHED" }) : null,
    );
    mock.redirect.create.mockResolvedValue({ id: "r1" });
    await updatePage(ID, pageUpdateSchema.parse({ slug: "privasi" }), "u1", now);
    expect(mock.redirect.create.mock.calls[0][0].data).toMatchObject({
      from: "/kebijakan-privasi",
      to: "/privasi",
      code: "PERMANENT",
    });
    expect(revalidate).toHaveBeenCalledWith(["pages", "page:privasi", "page:kebijakan-privasi"]);
  });

  it("hapus halaman biasa = soft delete", async () => {
    mock.page.findFirst.mockResolvedValue(pageRow());
    await deletePage(ID, "u1");
    expect(mock.page.update.mock.calls[0][0].data.deletedAt).toBeInstanceOf(Date);
  });
});

describe("publik", () => {
  it("daftar halaman untuk generateStaticParams: hanya STANDARD yang tayang", async () => {
    mock.page.findMany.mockResolvedValue([{ slug: "privasi", title: "Privasi" }]);
    await listPublicPages();
    expect(mock.page.findMany.mock.calls[0][0].where).toEqual({
      deletedAt: null,
      status: "PUBLISHED",
      kind: "STANDARD",
    });
  });

  it("detail: filter tayang + belum dihapus; tanpa field internal", async () => {
    mock.page.findFirst.mockResolvedValue(pageRow({ status: "PUBLISHED" }));
    const page = await getPublicPage("kebijakan-privasi");
    expect(mock.page.findFirst.mock.calls[0][0].where).toEqual({
      slug: "kebijakan-privasi",
      deletedAt: null,
      status: "PUBLISHED",
    });
    expect(Object.keys(page ?? {}).sort()).toEqual(["blocks", "kind", "seo", "slug", "title", "updatedAt"]);
  });
});

describe("resolvePageBlocks", () => {
  it("layanan di-resolve tanpa salinan, gambar/PDF yang hilang dilewati, rich text dirender aman", async () => {
    // Manual: SVC_B (draft/dihapus) tidak dikembalikan query publik -> tersaring.
    mock.service.findMany.mockImplementation(async ({ where }) =>
      where.id ? [serviceRow(SVC_A, "Layanan A")] : [serviceRow(SVC_A, "Layanan A"), serviceRow(SVC_B, "Layanan B")],
    );
    mock.media.findMany.mockResolvedValue([mediaRow(IMG), mediaRow(PDF, { mime: "image/png" })]);

    const result = await resolvePageBlocks([
      {
        id: block(1),
        type: "RICH_TEXT",
        body: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "<b>hai</b>" }] }] },
      },
      { id: block(2), type: "SERVICES", mode: "manual", ids: [SVC_B, SVC_A] },
      { id: block(3), type: "SERVICES", mode: "auto", limit: 1 },
      { id: block(4), type: "IMAGE", image: { mediaId: IMG } },
      { id: block(5), type: "IMAGE", image: { mediaId: "0199b4d0-0000-7000-8000-0000000000ff" } },
      { id: block(6), type: "DOWNLOAD", label: "Unduh", file: { mediaId: PDF } },
      { id: block(7), type: "LIST" },
    ]);

    expect(result.map((item) => item.type)).toEqual(["RICH_TEXT", "SERVICES", "SERVICES", "IMAGE"]);
    expect(result[0]).toMatchObject({ bodyHtml: "<p>&lt;b&gt;hai&lt;/b&gt;</p>" });
    expect(result[1]).toMatchObject({ items: [{ slug: "layanan-a" }] });
    expect(result[2]).toMatchObject({ items: [{ slug: "layanan-a" }] });
    // Satu query manual (semua id) + satu query auto.
    expect(mock.service.findMany).toHaveBeenCalledTimes(2);
    expect(mock.service.findMany.mock.calls.find(([args]) => args.where.id)?.[0].where).toMatchObject({
      id: { in: [SVC_B, SVC_A] },
      deletedAt: null,
      status: "PUBLISHED",
    });
  });
});
