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
  createClient,
  deleteClient,
  listClientOptions,
  listPublicClients,
  restoreClient,
  updateClient,
} from "@/services/client";
import { createMarketing, listPublicMarketing } from "@/services/marketing";
import { listPublicMediaPartners, updateMediaPartner } from "@/services/media-partner";
import { createTestimonial, listPublicTestimonials } from "@/services/testimonial";

const ID = "0199b4d0-0000-7000-8000-000000000001";
const LOGO = "0199b4d0-0000-7000-8000-0000000000aa";

// Kolom internal yang tidak boleh muncul di respons publik mana pun.
const INTERNAL_FIELDS = ["id", "order", "createdAt", "updatedAt", "deletedAt", "updatedById", "updatedBy"];

const base = {
  id: ID,
  order: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  updatedById: "u0",
};

const logoMedia = {
  id: LOGO,
  path: "2026/10/logo.svg",
  originalName: "logo.svg",
  mime: "image/svg+xml",
  size: 10,
  width: 100,
  height: 40,
  alt: "Logo PT Contoh",
  folder: "klien",
  variants: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  updatedById: null,
};

const clientRow = (extra: Record<string, unknown> = {}) => ({
  ...base,
  name: "PT Contoh",
  url: "https://contoh.example",
  logoId: LOGO,
  logo: logoMedia,
  ...extra,
});

let mock: MockDb;

beforeEach(() => {
  mock = createMockDb();
  db.current = mock;
  passThroughTransactions(mock);
  revalidate.mockClear();
});

describe("client", () => {
  it("create: logo divalidasi, urutan terakhir, audit, revalidate klien + beranda", async () => {
    mock.media.findMany.mockResolvedValue([{ id: LOGO, mime: "image/svg+xml", alt: null }]);
    mock.client.aggregate.mockResolvedValue({ _max: { order: 3 } });
    mock.client.create.mockResolvedValue(clientRow({ order: 4 }));

    const created = await createClient({ name: "PT Contoh", logoId: LOGO, url: null }, "u1");
    expect(mock.client.create.mock.calls[0][0].data).toMatchObject({ order: 4, updatedById: "u1" });
    expect(mock.auditLog.create.mock.calls[0][0].data).toMatchObject({ action: "CREATE", entity: "Client" });
    expect(revalidate).toHaveBeenCalledWith(["clients", "home"]);
    expect(created.logo?.url).toBe("/uploads/2026/10/logo.svg");
  });

  it("logo yang bukan gambar aktif: 422 per field", async () => {
    mock.media.findMany.mockResolvedValue([]);
    await expect(createClient({ name: "x", logoId: LOGO, url: null }, "u1")).rejects.toMatchObject({
      status: 422,
      fields: { logoId: ["Gambar tidak ditemukan atau sudah dihapus."] },
    });
  });

  it("update hanya field yang dikirim; diff audit", async () => {
    mock.client.findFirst.mockResolvedValue(clientRow());
    mock.client.update.mockResolvedValue(clientRow({ name: "PT Baru" }));
    await updateClient(ID, { name: "PT Baru" }, "u1");
    expect(mock.client.update.mock.calls[0][0].data).toEqual({ updatedById: "u1", name: "PT Baru" });
    expect(mock.auditLog.create.mock.calls[0][0].data.diff).toEqual({ name: { from: "PT Contoh", to: "PT Baru" } });
  });

  it("hapus = soft delete; pulihkan ke urutan terakhir; 404 kalau tidak ada", async () => {
    mock.client.findFirst.mockResolvedValueOnce(clientRow());
    await deleteClient(ID, "u1");
    expect(mock.client.update.mock.calls[0][0].data.deletedAt).toBeInstanceOf(Date);

    mock.client.findFirst.mockResolvedValueOnce(null);
    await expect(restoreClient(ID, "u1")).rejects.toMatchObject({ status: 404 });

    mock.client.findFirst.mockResolvedValueOnce(clientRow({ deletedAt: new Date() }));
    mock.client.aggregate.mockResolvedValue({ _max: { order: 9 } });
    mock.client.update.mockResolvedValue(clientRow({ order: 10 }));
    await restoreClient(ID, "u1");
    expect(mock.client.update.mock.calls.at(-1)?.[0].data).toMatchObject({ deletedAt: null, order: 10 });
  });

  it("options: search + limit, thumbnail dari logo", async () => {
    mock.client.findMany.mockResolvedValue([clientRow()]);
    const options = await listClientOptions({ q: "contoh", limit: 10, ids: [] });
    expect(mock.client.findMany).toHaveBeenCalledTimes(1);
    expect(mock.client.findMany.mock.calls[0][0]).toMatchObject({
      where: { deletedAt: null, name: { contains: "contoh", mode: "insensitive" } },
      take: 10,
    });
    expect(options).toEqual([{ id: ID, label: "PT Contoh", sublabel: null, imageUrl: "/uploads/2026/10/logo.svg" }]);
  });
});

describe("endpoint publik tidak membawa field internal", () => {
  it("klien: logo di Sampah tidak tampil", async () => {
    mock.client.findMany.mockResolvedValue([clientRow(), clientRow({ logo: { ...logoMedia, deletedAt: new Date() } })]);
    const result = await listPublicClients();
    expect(mock.client.findMany.mock.calls[0][0].where).toEqual({ deletedAt: null });
    expect(Object.keys(result[0]).sort()).toEqual(["logo", "name", "url"]);
    expect(Object.keys(result[0].logo ?? {}).sort()).toEqual(["alt", "height", "mime", "url", "variants", "width"]);
    expect(result[1].logo).toBeNull();
  });

  it("testimoni", async () => {
    mock.testimonial.findMany.mockResolvedValue([
      { ...base, name: "Budi", role: "Manajer HR", company: "PT A", quote: "Bagus.", photoId: null, photo: null },
    ]);
    const [entry] = await listPublicTestimonials();
    expect(Object.keys(entry).sort()).toEqual(["company", "name", "photo", "quote", "role"]);
  });

  it("marketing: hanya yang aktif, tautan WhatsApp dengan pesan default", async () => {
    mock.marketingContact.findMany.mockResolvedValue([
      {
        ...base,
        name: "Sari",
        phone: "6281234567890",
        defaultMessage: "Halo, saya ingin bertanya",
        active: true,
        photoId: null,
        photo: null,
      },
    ]);
    const [entry] = await listPublicMarketing();
    expect(mock.marketingContact.findMany.mock.calls[0][0].where).toEqual({ deletedAt: null, active: true });
    expect(Object.keys(entry).sort()).toEqual(["area", "defaultMessage", "name", "phone", "photo", "whatsappUrl"]);
    expect(entry.whatsappUrl).toBe("https://wa.me/6281234567890?text=Halo%2C%20saya%20ingin%20bertanya");
    for (const field of INTERNAL_FIELDS) expect(entry).not.toHaveProperty(field);
  });

  it("media partner", async () => {
    mock.mediaPartner.findMany.mockResolvedValue([{ ...base, name: "Majalah HR", url: null }]);
    const [entry] = await listPublicMediaPartners();
    expect(entry).toEqual({ name: "Majalah HR", url: null });
  });
});

describe("revalidate per entitas", () => {
  it("testimoni: testimonials + home; marketing: marketing; media partner: media-partners", async () => {
    mock.testimonial.aggregate.mockResolvedValue({ _max: { order: null } });
    mock.testimonial.create.mockResolvedValue({
      ...base,
      name: "Budi",
      role: null,
      company: null,
      quote: "x",
      photoId: null,
      photo: null,
    });
    await createTestimonial({ name: "Budi", role: null, company: null, quote: "x", photoId: null }, "u1");
    expect(revalidate).toHaveBeenLastCalledWith(["testimonials", "home"]);

    mock.marketingContact.aggregate.mockResolvedValue({ _max: { order: null } });
    mock.marketingContact.create.mockResolvedValue({
      ...base,
      name: "Sari",
      phone: "6281234567890",
      defaultMessage: null,
      active: true,
      photoId: null,
      photo: null,
    });
    await createMarketing({ name: "Sari", area: null, phone: "6281234567890", photoId: null, defaultMessage: null, active: true }, "u1");
    expect(revalidate).toHaveBeenLastCalledWith(["marketing"]);

    mock.mediaPartner.findFirst.mockResolvedValue({ ...base, name: "A", url: null });
    mock.mediaPartner.update.mockResolvedValue({ ...base, name: "B", url: null });
    await updateMediaPartner(ID, { name: "B" }, "u1");
    expect(revalidate).toHaveBeenLastCalledWith(["media-partners"]);
  });
});
