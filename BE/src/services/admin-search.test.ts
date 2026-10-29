import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { createMockDb, passThroughTransactions, type MockDb } from "@/test/mock-db";
import { adminSearchQuerySchema } from "@/lib/validators/search";

const db = vi.hoisted(() => ({ current: undefined as unknown }));
vi.mock("@/lib/db", () => ({ getDb: () => db.current }));

import { adminSearch, PER_GROUP } from "@/services/admin-search";

let mock: MockDb;
const at = (iso: string) => new Date(iso);

// $queryRaw dipanggil sebagai tagged template; rakit ulang jadi satu Prisma.Sql untuk diperiksa.
function rawCalls() {
  return (mock.$queryRaw.mock.calls as [TemplateStringsArray, ...unknown[]][]).map(([strings, ...values]) =>
    Prisma.sql(strings, ...values),
  );
}
const callFor = (table: string) => rawCalls().find((call) => call.sql.includes(`FROM "${table}"`));

beforeEach(() => {
  mock = createMockDb();
  passThroughTransactions(mock);
  db.current = mock;
  mock.$queryRaw.mockResolvedValue([]);
  mock.$executeRaw.mockResolvedValue(0);
  mock.page.findMany.mockResolvedValue([]);
  mock.homeSection.findMany.mockResolvedValue([]);
  mock.navItem.findMany.mockResolvedValue([]);
  mock.siteSetting.findMany.mockResolvedValue([]);
});

describe("adminSearchQuerySchema", () => {
  it("2-100 karakter setelah trim", () => {
    expect(adminSearchQuerySchema.safeParse({ q: " a " }).success).toBe(false);
    expect(adminSearchQuerySchema.safeParse({ q: "x".repeat(101) }).success).toBe(false);
    expect(adminSearchQuerySchema.safeParse({}).success).toBe(false);
    expect(adminSearchQuerySchema.parse({ q: "  wa  " })).toEqual({ q: "wa" });
  });
});

describe("adminSearch", () => {
  it("grup kosong tidak dikirim; urutan grup tetap", async () => {
    mock.$queryRaw.mockImplementation(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const sql = Prisma.sql(strings, ...values).sql;
      if (sql.includes('FROM "Training"')) return [{ id: "t1", title: "Pilot Drone", meta: "pilot-drone", status: "DRAFT" }];
      if (sql.includes('FROM "Media"')) return [{ id: "m1", title: "pilot.jpg", meta: null, status: null }];
      return [];
    });
    const result = await adminSearch("pilot");
    expect(result.q).toBe("pilot");
    expect(result.groups.map((group) => group.group)).toEqual(["trainings", "media"]);
    expect(result.groups[0].items[0]).toEqual({ id: "t1", title: "Pilot Drone", meta: "pilot-drone", status: "DRAFT" });
  });

  it("pelatihan: full-text + trigram + slug, draf ikut (tanpa filter status), Sampah tidak", async () => {
    await adminSearch("pilot drone");
    const call = callFor("Training");
    expect(call?.sql).toContain(`t."deletedAt" IS NULL`);
    expect(call?.sql).not.toContain(`"status" = 'PUBLISHED'`);
    expect(call?.sql).toContain("to_tsquery('public.simple_unaccent'");
    expect(call?.sql).toContain(`<% t."searchTitle"`);
    expect(call?.values).toContain("pilot:* & drone:*");
    expect(call?.values).toContain(PER_GROUP);
    // Ambang typo dipasang per transaksi.
    expect(mock.$executeRaw).toHaveBeenCalled();
  });

  it("entitas teks pendek: LIKE tanpa aksen dengan wildcard di-escape, Sampah tidak ikut", async () => {
    await adminSearch("50%_off");
    for (const table of ["Category", "Service", "PortfolioItem", "Client", "Testimonial", "MarketingContact", "Media"]) {
      const call = callFor(table);
      expect(call?.sql, table).toContain(`"deletedAt" IS NULL`);
      expect(call?.sql, table).toContain("public.immutable_unaccent(lower(");
      expect(call?.sql, table).toContain(String.raw`ESCAPE '\'`);
      expect(call?.values, table).toContain(String.raw`%50\%\_off%`);
    }
  });

  it("halaman: cocok di nilai teks blok (termasuk draf), bukan di nama node rich text", async () => {
    mock.page.findMany.mockResolvedValue([
      {
        id: "p1",
        title: "Syarat & ketentuan",
        slug: "syarat",
        status: "DRAFT",
        updatedAt: at("2026-10-01T00:00:00Z"),
        blocks: [{ type: "RICH_TEXT", body: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Pembayaran via transfer" }] }] } }],
      },
    ]);
    const hit = await adminSearch("transfer");
    expect(hit.groups).toEqual([
      { group: "pages", items: [{ id: "p1", title: "Syarat & ketentuan", meta: "Pembayaran via transfer", status: "DRAFT" }] },
    ]);
    expect(mock.page.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { deletedAt: null } }));

    const typeName = await adminSearch("paragraph");
    expect(typeName.groups).toEqual([]);
  });

  it("section beranda: judul cocok -> jenis section; isi cocok -> potongan teks", async () => {
    mock.homeSection.findMany.mockResolvedValue([
      { id: "h1", type: "STATS", title: "Angka kami", content: { items: [{ label: "Trainer" }] }, updatedAt: at("2026-10-01T00:00:00Z") },
      { id: "h2", type: "CTA", title: null, content: { heading: "Butuh pelatihan khusus?", primaryCta: { label: "Hubungi", href: "/kontak" } }, updatedAt: at("2026-10-02T00:00:00Z") },
    ]);
    expect((await adminSearch("angka")).groups[0].items).toEqual([{ id: "h1", title: "Angka kami", meta: "STATS", status: null }]);
    expect((await adminSearch("khusus")).groups[0].items).toEqual([{ id: "h2", title: "CTA", meta: "Butuh pelatihan khusus?", status: null }]);
    // href tidak dicari.
    expect((await adminSearch("kontak")).groups).toEqual([]);
  });

  it("judul yang diawali kata kunci tampil lebih dulu, maks PER_GROUP", async () => {
    const pages = Array.from({ length: 8 }, (_, index) => ({
      id: `p${index}`,
      title: index === 7 ? "Drone dasar" : `Kelas drone ${index}`,
      slug: `p${index}`,
      status: "PUBLISHED",
      blocks: [],
      updatedAt: at(`2026-10-0${index + 1}T00:00:00Z`),
    }));
    mock.page.findMany.mockResolvedValue(pages);
    const items = (await adminSearch("drone")).groups[0].items;
    expect(items).toHaveLength(PER_GROUP);
    expect(items[0].id).toBe("p7");
    expect(items[1].id).toBe("p6");
  });

  it("pengaturan: satu hasil per properti yang cocok, referensi media (*Id) dilewati", async () => {
    mock.siteSetting.findMany.mockResolvedValue([
      { key: "site.contact", value: { phone: "021 0000 0000", whatsapp: "6281200000001", email: "info@example.com" } },
      { key: "site.identity", value: { name: "Lembaga Contoh", logoLightId: "6281-media" } },
      { key: "site.social", value: { links: [{ platform: "instagram", label: "Instagram", url: "https://instagram.com/contoh" }] } },
    ]);
    const result = await adminSearch("6281");
    expect(result.groups).toEqual([
      { group: "settings", items: [{ id: "site.contact", field: "whatsapp", title: "6281200000001", meta: null, status: null }] },
    ]);
    const social = await adminSearch("instagram");
    expect(social.groups[0].items).toEqual([{ id: "site.social", field: "links", title: "Instagram", meta: null, status: null }]);
  });

  it("navigasi: label cocok, Sampah tidak ikut", async () => {
    mock.navItem.findMany.mockResolvedValue([
      { id: "n1", label: "Jadwal Training", href: "/jadwal", location: "HEADER", updatedAt: at("2026-10-01T00:00:00Z") },
    ]);
    expect((await adminSearch("jadwal")).groups[0]).toEqual({
      group: "navigation",
      items: [{ id: "n1", title: "Jadwal Training", meta: "HEADER · /jadwal", status: null }],
    });
    expect(mock.navItem.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { deletedAt: null } }));
  });
});
