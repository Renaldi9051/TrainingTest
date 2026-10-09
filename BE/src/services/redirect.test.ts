import { beforeEach, describe, expect, it, vi } from "vitest";
import { recordSlugRedirect } from "@/services/redirect";

function createTx() {
  return {
    redirect: {
      findFirst: vi.fn(),
      update: vi.fn(async ({ where }: { where: { id: string } }) => ({ id: where.id })),
      updateMany: vi.fn(),
      create: vi.fn(async () => ({ id: "new-redirect" })),
    },
    auditLog: { create: vi.fn() },
  };
}

let tx: ReturnType<typeof createTx>;
beforeEach(() => {
  tx = createTx();
});

const run = (from: string, to: string) =>
  recordSlugRedirect(tx as unknown as Parameters<typeof recordSlugRedirect>[0], {
    from,
    to,
    userId: "u1",
  });

describe("recordSlugRedirect", () => {
  it("slug sama: tidak melakukan apa pun", async () => {
    await run("/pelatihan/a", "/pelatihan/a");
    expect(tx.redirect.create).not.toHaveBeenCalled();
    expect(tx.redirect.findFirst).not.toHaveBeenCalled();
  });

  it("membuat redirect 301 baru dan meratakan rantai ke path lama", async () => {
    tx.redirect.findFirst.mockResolvedValue(null);
    await run("/pelatihan/lama", "/pelatihan/baru");

    expect(tx.redirect.updateMany).toHaveBeenCalledWith({
      where: { to: "/pelatihan/lama", deletedAt: null },
      data: { to: "/pelatihan/baru", updatedById: "u1" },
    });
    expect(tx.redirect.create.mock.calls[0]).toMatchObject([
      { data: { from: "/pelatihan/lama", to: "/pelatihan/baru", code: "PERMANENT" } },
    ]);
    expect(tx.auditLog.create).toHaveBeenCalledTimes(1);
  });

  it("menonaktifkan redirect aktif yang berasal dari path baru", async () => {
    tx.redirect.findFirst.mockImplementation(async ({ where }: { where: { from: string } }) =>
      where.from === "/pelatihan/baru"
        ? { id: "r-old", from: "/pelatihan/baru", to: "/pelatihan/x" }
        : null,
    );
    await run("/pelatihan/lama", "/pelatihan/baru");
    expect(tx.redirect.update.mock.calls[0][0]).toMatchObject({
      where: { id: "r-old" },
      data: { deletedAt: expect.any(Date) },
    });
  });

  it("redirect dari path lama yang sudah ada diperbarui, bukan dibuat dobel", async () => {
    tx.redirect.findFirst.mockImplementation(async ({ where }: { where: { from: string } }) =>
      where.from === "/pelatihan/lama" ? { id: "r1", from: "/pelatihan/lama", to: "/x" } : null,
    );
    await run("/pelatihan/lama", "/pelatihan/baru");
    expect(tx.redirect.create).not.toHaveBeenCalled();
    expect(tx.redirect.update.mock.calls[0][0]).toMatchObject({
      where: { id: "r1" },
      data: { to: "/pelatihan/baru" },
    });
  });
});
