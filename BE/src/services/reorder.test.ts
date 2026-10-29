import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockDb, passThroughTransactions, type MockDb } from "@/test/mock-db";

const db = vi.hoisted(() => ({ current: undefined as unknown }));
vi.mock("@/lib/db", () => ({ getDb: () => db.current }));
const revalidate = vi.hoisted(() => vi.fn(async () => true));
vi.mock("@/lib/revalidate", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/revalidate")>()),
  revalidateTags: revalidate,
}));

import { nextOrder, reorderResource, type ReorderResource } from "@/services/reorder";

let mock: MockDb;

beforeEach(() => {
  mock = createMockDb();
  db.current = mock;
  passThroughTransactions(mock);
  revalidate.mockClear();
});

const CASES: [ReorderResource, keyof MockDb, string, string[]][] = [
  ["categories", "category", "Category", ["categories", "home", "trainings"]],
  ["services", "service", "Service", ["services", "home", "pages"]],
  ["clients", "client", "Client", ["clients", "home"]],
  ["testimonials", "testimonial", "Testimonial", ["testimonials", "home"]],
  ["portfolio", "portfolioItem", "PortfolioItem", ["portfolio"]],
  ["marketing", "marketingContact", "MarketingContact", ["marketing"]],
  ["home-sections", "homeSection", "HomeSection", ["home"]],
];

describe("reorderResource", () => {
  it.each(CASES)("%s: urutan baru dalam transaksi, audit REORDER, revalidate tag entitas", async (resource, model, entity, tags) => {
    const delegate = mock[model] as MockDb["service"];
    delegate.findMany.mockResolvedValue([{ id: "a" }, { id: "b" }, { id: "c" }]);

    await reorderResource(resource, { ids: ["c", "a", "b"] }, "u1");

    expect(delegate.findMany.mock.calls[0][0]).toEqual({ where: { deletedAt: null }, select: { id: true } });
    expect(mock.$transaction).toHaveBeenCalledTimes(1);
    expect(delegate.update.mock.calls.map(([args]) => [args.where.id, args.data])).toEqual([
      ["c", { order: 0, updatedById: "u1" }],
      ["a", { order: 1, updatedById: "u1" }],
      ["b", { order: 2, updatedById: "u1" }],
    ]);
    expect(mock.auditLog.create.mock.calls[0][0].data).toMatchObject({
      action: "REORDER",
      entity,
      diff: { ids: ["c", "a", "b"] },
    });
    expect(revalidate).toHaveBeenCalledWith(tags);
  });

  it.each([
    ["kurang satu", ["a", "b"]],
    ["berisi id di Sampah / asing", ["a", "b", "x"]],
  ])("422 kalau daftar id %s, tanpa menulis apa pun", async (_label, ids) => {
    mock.client.findMany.mockResolvedValue([{ id: "a" }, { id: "b" }, { id: "c" }]);
    await expect(reorderResource("clients", { ids }, "u1")).rejects.toMatchObject({
      status: 422,
      message: "Urutan harus berisi semua klien aktif.",
      fields: { ids: ["Daftar klien tidak lengkap atau berisi klien yang sudah dihapus."] },
    });
    expect(mock.client.update).not.toHaveBeenCalled();
    expect(revalidate).not.toHaveBeenCalled();
  });
});

describe("nextOrder", () => {
  it("setelah baris aktif terakhir; tabel kosong = 0", async () => {
    mock.client.aggregate.mockResolvedValueOnce({ _max: { order: 4 } }).mockResolvedValueOnce({ _max: { order: null } });
    expect(await nextOrder(mock.client)).toBe(5);
    expect(await nextOrder(mock.client)).toBe(0);
    expect(mock.client.aggregate.mock.calls[0][0]).toEqual({ where: { deletedAt: null }, _max: { order: true } });
  });
});
