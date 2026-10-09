import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockDb, type MockDb } from "@/test/mock-db";

const db = vi.hoisted(() => ({ current: undefined as unknown }));
vi.mock("@/lib/db", () => ({ getDb: () => db.current }));
const revalidate = vi.hoisted(() => vi.fn<(tags: string[]) => Promise<boolean>>(async () => true));
vi.mock("@/lib/revalidate", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/revalidate")>()),
  revalidateTags: revalidate,
}));

import { revalidateDuePublications, revalidateOnDayChange } from "@/services/publish-scheduler";

const now = new Date("2026-10-10T05:00:00.000Z");
let mock: MockDb & { training: MockDb["training"] & { fields: { publishedAt: string } } };

beforeEach(() => {
  const base = createMockDb();
  mock = { ...base, training: { ...base.training, fields: { publishedAt: "publishedAt-ref" } } };
  db.current = mock;
  revalidate.mockReset();
  revalidate.mockResolvedValue(true);
});

describe("revalidateDuePublications", () => {
  it("mencari pelatihan yang waktunya tiba tapi belum di-revalidate", async () => {
    mock.training.findMany.mockResolvedValue([]);
    expect(await revalidateDuePublications(now)).toBe(0);
    expect(mock.training.findMany.mock.calls[0][0].where).toEqual({
      status: "PUBLISHED",
      deletedAt: null,
      publishedAt: { lte: now },
      OR: [{ publishRevalidatedAt: null }, { publishRevalidatedAt: { lt: "publishedAt-ref" } }],
    });
    expect(revalidate).not.toHaveBeenCalled();
  });

  it("revalidate tag katalog + slug, lalu tandai sudah di-revalidate", async () => {
    mock.training.findMany.mockResolvedValue([{ id: "a", slug: "kpi" }]);
    expect(await revalidateDuePublications(now)).toBe(1);
    expect(revalidate).toHaveBeenCalledWith(["trainings", "categories", "schedules", "training:kpi"]);
    expect(mock.training.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["a"] } },
      data: { publishRevalidatedAt: now },
    });
  });

  it("FE tidak bisa dihubungi: tidak ditandai, dicoba lagi putaran berikutnya", async () => {
    mock.training.findMany.mockResolvedValue([{ id: "a", slug: "kpi" }]);
    revalidate.mockResolvedValue(false);
    expect(await revalidateDuePublications(now)).toBe(0);
    expect(mock.training.updateMany).not.toHaveBeenCalled();
  });
});

describe("revalidateOnDayChange", () => {
  it("revalidate jadwal & katalog sekali per tanggal WIB", async () => {
    expect(await revalidateOnDayChange(null, now)).toBe("2026-10-10");
    expect(revalidate).toHaveBeenCalledWith(["schedules", "trainings"]);
    revalidate.mockClear();
    expect(await revalidateOnDayChange("2026-10-10", now)).toBe("2026-10-10");
    expect(revalidate).not.toHaveBeenCalled();
  });
});
