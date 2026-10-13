import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockDb, type MockDb } from "@/test/mock-db";

const db = vi.hoisted(() => ({ current: undefined as unknown }));
vi.mock("@/lib/db", () => ({ getDb: () => db.current }));

import { getDashboard, STALE_DRAFT_DAYS, trainingIssueWhere } from "@/services/dashboard";

// 13 Okt 2026 10.00 WIB.
const now = new Date("2026-10-13T03:00:00Z");
let mock: MockDb;

beforeEach(() => {
  mock = createMockDb();
  db.current = mock;
  for (const model of Object.values(mock)) {
    if (typeof model === "object" && "count" in model) {
      model.count.mockResolvedValue(0);
      model.findMany.mockResolvedValue([]);
    }
  }
});

describe("trainingIssueWhere", () => {
  it("draft lama: belum diubah lebih dari 30 hari", () => {
    const where = trainingIssueWhere("stale-draft", now);
    expect(where).toMatchObject({ status: "DRAFT" });
    const lt = (where.updatedAt as { lt: Date }).lt;
    expect(now.getTime() - lt.getTime()).toBe(STALE_DRAFT_DAYS * 24 * 60 * 60 * 1000);
  });

  it("SEO kosong bukan masalah (fallback judul/ringkasan); yang ditandai hanya ringkasan DAN SEO description kosong", () => {
    const where = trainingIssueWhere("no-summary", now);
    expect(where.status).toBe("PUBLISHED");
    expect(JSON.stringify(where)).toContain("description");
    expect(JSON.stringify(where)).toContain("summary");
  });

  it("sampul tanpa alt: relasi cover dengan alt kosong", () => {
    expect(trainingIssueWhere("cover-no-alt", now)).toEqual({ cover: { is: { OR: [{ alt: null }, { alt: "" }] } } });
    expect(trainingIssueWhere("no-cover", now)).toEqual({ coverId: null });
  });
});

describe("getDashboard", () => {
  it("hitungan memakai hari & bulan WIB dan tanpa item di Sampah; slot inquiry/evaluasi null", async () => {
    mock.training.count.mockResolvedValue(3);
    const dashboard = await getDashboard(now);
    expect(dashboard.inquiries).toBeNull();
    expect(dashboard.evaluations).toBeNull();
    expect(dashboard.counts.trainings).toEqual({ published: 3, scheduled: 3, draft: 3 });
    for (const call of [...mock.training.count.mock.calls, ...mock.schedule.count.mock.calls, ...mock.category.count.mock.calls]) {
      expect(call[0].where.deletedAt).toBeNull();
    }
    const monthCall = mock.schedule.count.mock.calls.find((call) => call[0].where.startDate?.lt);
    expect(monthCall?.[0].where.startDate).toEqual({ gte: new Date("2026-10-01T00:00:00Z"), lt: new Date("2026-11-01T00:00:00Z") });
  });

  it("perlu dibereskan: urutan tetap, jadwal lewat masih DIBUKA berisi judul + tanggal", async () => {
    mock.schedule.findMany.mockResolvedValue([
      { id: "s1", startDate: new Date("2026-09-01T00:00:00Z"), endDate: new Date("2026-09-02T00:00:00Z"), training: { title: "Pilot drone" } },
    ]);
    mock.schedule.count.mockResolvedValue(1);
    const { attention } = await getDashboard(now);
    expect(attention.map((group) => group.key)).toEqual([
      "trainingNoCover",
      "trainingCoverNoAlt",
      "staleDraft",
      "publishedNoSummary",
      "pastOpenSchedule",
      "serviceNoImage",
    ]);
    const past = attention.find((group) => group.key === "pastOpenSchedule");
    expect(past?.items).toEqual([{ id: "s1", title: "Pilot drone", detail: "2026-09-01 s.d. 2026-09-02" }]);
    const pastCall = mock.schedule.findMany.mock.calls[0][0];
    expect(pastCall.where).toMatchObject({ status: "OPEN", endDate: { lt: new Date("2026-10-13T00:00:00Z") } });
  });

  it("aktivitas: nama admin, Sistem kalau tanpa user; hanya entitas yang masih ada yang bisa ditautkan", async () => {
    mock.auditLog.findMany.mockResolvedValue([
      { id: "a1", action: "UPDATE", entity: "Training", entityId: "t1", createdAt: now, user: { name: "Ade" } },
      { id: "a2", action: "DELETE", entity: "Training", entityId: "t2", createdAt: now, user: { name: "Ade" } },
      { id: "a3", action: "UPDATE", entity: "ContentSync", entityId: null, createdAt: now, user: null },
    ]);
    mock.training.findMany.mockImplementation(async (args: { where: { id?: { in: string[] } } }) =>
      args.where.id ? [{ id: "t1" }] : [],
    );
    const { activity } = await getDashboard(now);
    expect(activity.map(({ id, userName, linkable }) => ({ id, userName, linkable }))).toEqual([
      { id: "a1", userName: "Ade", linkable: true },
      { id: "a2", userName: "Ade", linkable: false },
      { id: "a3", userName: null, linkable: false },
    ]);
  });
});
