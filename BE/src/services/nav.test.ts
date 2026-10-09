import { beforeEach, describe, expect, it, vi } from "vitest";
import { navCreateSchema, navUpdateSchema } from "@/lib/validators/nav";
import { createMockDb, passThroughTransactions, type MockDb } from "@/test/mock-db";

const db = vi.hoisted(() => ({ current: undefined as unknown }));
vi.mock("@/lib/db", () => ({ getDb: () => db.current }));
const revalidate = vi.hoisted(() => vi.fn());
vi.mock("@/lib/revalidate", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/revalidate")>()),
  revalidateTags: revalidate,
}));

import { createNavItem, deleteNavItem, getPublicNav, reorderNav, updateNavItem } from "@/services/nav";

const id = (n: number) => `0199b4d0-0000-7000-8000-${String(n).padStart(12, "0")}`;
const item = (n: number, extra: Partial<Record<string, unknown>> = {}) => ({
  id: id(n),
  location: "HEADER",
  label: `Menu ${n}`,
  href: `/m${n}`,
  parentId: null,
  order: n,
  createdAt: new Date(2026, 0, n),
  updatedAt: new Date(),
  deletedAt: null,
  updatedById: null,
  ...extra,
});

let mock: MockDb;
beforeEach(() => {
  mock = createMockDb();
  db.current = mock;
  passThroughTransactions(mock);
  revalidate.mockReset();
  mock.navItem.aggregate.mockResolvedValue({ _max: { order: 2 } });
});

describe("validator navigasi", () => {
  it("href internal atau http(s); javascript: dan // ditolak", () => {
    const base = { location: "HEADER", label: "Jadwal" };
    expect(navCreateSchema.safeParse({ ...base, href: "/jadwal" }).success).toBe(true);
    expect(navCreateSchema.safeParse({ ...base, href: "https://example.com" }).success).toBe(true);
    expect(navCreateSchema.safeParse({ ...base, href: "javascript:alert(1)" }).success).toBe(false);
    expect(navCreateSchema.safeParse({ ...base, href: "//evil.example" }).success).toBe(false);
    expect(navCreateSchema.safeParse({ ...base, href: "/a b" }).success).toBe(false);
    expect(navCreateSchema.safeParse({ ...base, href: "/x", location: "SIDEBAR" }).success).toBe(false);
  });

  it("update kosong ditolak", () => {
    expect(navUpdateSchema.safeParse({}).success).toBe(false);
  });
});

describe("createNavItem", () => {
  it("urutan = terakhir + 1, audit, revalidate tag nav", async () => {
    mock.navItem.create.mockResolvedValue(item(9, { order: 3 }));
    await createNavItem({ location: "HEADER", label: "Menu 9", href: "/m9", parentId: null }, "u1");
    expect(mock.navItem.create.mock.calls[0][0].data).toMatchObject({ order: 3, parentId: null });
    expect(mock.auditLog.create).toHaveBeenCalled();
    expect(revalidate).toHaveBeenCalledWith(["nav"]);
  });

  it("menolak induk yang sudah berupa submenu (maks 1 level)", async () => {
    mock.navItem.findFirst.mockResolvedValue(item(1, { parentId: id(2) }));
    await expect(
      createNavItem({ location: "HEADER", label: "X", href: "/x", parentId: id(1) }, "u1"),
    ).rejects.toMatchObject({ status: 422, fields: { parentId: [expect.stringMatching(/1 level/)] } });
    expect(mock.navItem.create).not.toHaveBeenCalled();
  });

  it("menolak induk dari lokasi lain", async () => {
    mock.navItem.findFirst.mockResolvedValue(item(1, { location: "FOOTER" }));
    await expect(
      createNavItem({ location: "HEADER", label: "X", href: "/x", parentId: id(1) }, "u1"),
    ).rejects.toMatchObject({ status: 422 });
  });
});

describe("updateNavItem", () => {
  it("menu yang punya submenu tidak bisa dijadikan submenu", async () => {
    mock.navItem.findFirst
      .mockResolvedValueOnce(item(1))
      .mockResolvedValueOnce(item(2));
    mock.navItem.count.mockResolvedValue(1);
    await expect(updateNavItem(id(1), { parentId: id(2) }, "u1")).rejects.toMatchObject({
      status: 422,
    });
  });
});

describe("deleteNavItem", () => {
  it("soft delete item beserta submenunya", async () => {
    mock.navItem.findFirst.mockResolvedValue(item(1));
    await deleteNavItem(id(1), "u1");
    expect(mock.navItem.updateMany.mock.calls[0][0]).toMatchObject({
      where: { OR: [{ id: id(1) }, { parentId: id(1) }], deletedAt: null },
      data: { deletedAt: expect.any(Date) },
    });
  });
});

describe("reorderNav", () => {
  it("menyimpan urutan sesuai posisi dalam satu transaksi", async () => {
    mock.navItem.findFirst.mockResolvedValue(item(1));
    mock.navItem.findMany.mockResolvedValue([{ id: id(1) }, { id: id(2) }, { id: id(3) }]);
    await reorderNav({ ids: [id(3), id(1), id(2)] }, "u1");
    expect(mock.$transaction).toHaveBeenCalledTimes(1);
    expect(mock.navItem.update.mock.calls.map((call) => [call[0].where.id, call[0].data.order])).toEqual([
      [id(3), 0],
      [id(1), 1],
      [id(2), 2],
    ]);
    expect(revalidate).toHaveBeenCalledWith(["nav"]);
  });

  it("menolak daftar yang tidak lengkap atau dari kelompok lain", async () => {
    mock.navItem.findFirst.mockResolvedValue(item(1));
    mock.navItem.findMany.mockResolvedValue([{ id: id(1) }, { id: id(2) }]);
    await expect(reorderNav({ ids: [id(1)] }, "u1")).rejects.toMatchObject({ status: 422 });
    await expect(reorderNav({ ids: [id(1), id(5)] }, "u1")).rejects.toMatchObject({ status: 422 });
    expect(mock.navItem.update).not.toHaveBeenCalled();
  });
});

describe("getPublicNav", () => {
  it("membentuk pohon header/footer terurut", async () => {
    mock.navItem.findMany.mockResolvedValue([
      item(2, { order: 1 }),
      item(1, { order: 0 }),
      item(3, { parentId: id(1), order: 0 }),
      item(4, { location: "FOOTER", order: 0 }),
    ]);
    expect(await getPublicNav()).toEqual({
      header: [
        { label: "Menu 1", href: "/m1", children: [{ label: "Menu 3", href: "/m3", children: [] }] },
        { label: "Menu 2", href: "/m2", children: [] },
      ],
      footer: [{ label: "Menu 4", href: "/m4", children: [] }],
    });
  });
});
