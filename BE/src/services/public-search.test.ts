import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { MemoryRateLimiter, PUBLIC_SEARCH_MAX, PUBLIC_SEARCH_WINDOW_MS } from "@/lib/rate-limit";
import { publicSearchQuerySchema } from "@/lib/validators/search";
import { createMockDb, passThroughTransactions, type MockDb } from "@/test/mock-db";

const db = vi.hoisted(() => ({ current: undefined as unknown }));
vi.mock("@/lib/db", () => ({ getDb: () => db.current }));

import { publicSearch } from "@/services/public-search";

const now = new Date("2026-10-14T05:00:00.000Z");
const meta = { ip: "203.0.113.5" };
let mock: MockDb;

const freshLimiter = () => new MemoryRateLimiter(PUBLIC_SEARCH_MAX, PUBLIC_SEARCH_WINDOW_MS);

function rawCalls() {
  return (mock.$queryRaw.mock.calls as [TemplateStringsArray, ...unknown[]][]).map(([strings, ...values]) =>
    Prisma.sql(strings, ...values),
  );
}
const callFor = (table: string) => rawCalls().find((call) => call.sql.includes(`FROM "${table}"`) && !call.sql.startsWith(`SELECT count`));

beforeEach(() => {
  mock = createMockDb();
  passThroughTransactions(mock);
  db.current = mock;
  mock.$queryRaw.mockResolvedValue([]);
  mock.$executeRaw.mockResolvedValue(0);
});

describe("publicSearchQuerySchema", () => {
  it("2-100 karakter setelah trim", () => {
    expect(publicSearchQuerySchema.safeParse({ q: "a" }).success).toBe(false);
    expect(publicSearchQuerySchema.safeParse({ q: "x".repeat(101) }).success).toBe(false);
    expect(publicSearchQuerySchema.parse({ q: " drone " })).toEqual({ q: "drone" });
  });
});

describe("publicSearch: hanya konten yang tampil publik", () => {
  it("pelatihan: PUBLISHED, tidak di Sampah, waktu tayang sudah lewat (draf & terjadwal tidak ikut)", async () => {
    await publicSearch("pilot drone", meta, now, freshLimiter());
    const call = rawCalls().find((sql) => sql.sql.includes(`FROM "Training" t`) && sql.sql.includes("ORDER BY ("));
    expect(call?.sql).toContain(`t."deletedAt" IS NULL`);
    expect(call?.sql).toContain(`t."status" = 'PUBLISHED'`);
    expect(call?.sql).toContain(`t."publishedAt" IS NOT NULL AND t."publishedAt" <= `);
    expect(call?.values).toContain(now);
    expect(call?.values).toContain("pilot:* & drone:*");
  });

  it("layanan: PUBLISHED dan tidak di Sampah", async () => {
    await publicSearch("drone", meta, now, freshLimiter());
    expect(callFor("Service")?.sql).toContain(`s."deletedAt" IS NULL AND s."status" = 'PUBLISHED'`);
  });

  it("kategori: tidak di Sampah; jumlah hanya pelatihan tayang; tanpa pelatihan tayang tidak tampil", async () => {
    await publicSearch("drone", meta, now, freshLimiter());
    const categories = callFor("Category");
    expect(categories?.sql).toContain(`c."deletedAt" IS NULL`);
    // Subquery jumlah memakai aturan tayang yang sama dengan pelatihan (draf/terjadwal/Sampah tidak dihitung).
    const countSubquery = categories?.sql.slice(categories.sql.indexOf("SELECT count(*)")) ?? "";
    expect(countSubquery).toContain(`t."deletedAt" IS NULL AND t."status" = 'PUBLISHED' AND t."publishedAt" IS NOT NULL AND t."publishedAt" <= `);
    expect(categories?.values).toContain(now);
    expect(categories?.sql).toContain(`WHERE matched."trainingCount" > 0`);
  });

  it("grup kosong tidak dikirim; item tanpa id/status", async () => {
    mock.$queryRaw.mockImplementation(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const sql = Prisma.sql(strings, ...values).sql;
      if (sql.includes(`FROM "Training" t`) && sql.includes("ORDER BY (")) return [{ slug: "pilot-dasar", title: "Pilot dasar", meta: "Pilot Drone" }];
      if (sql.includes(`FROM "Category" c`)) return [{ slug: "pilot", title: "Pilot", trainingCount: 12 }];
      return [];
    });
    const result = await publicSearch("pilot", meta, now, freshLimiter());
    expect(result).toEqual({
      q: "pilot",
      groups: [
        { group: "trainings", items: [{ slug: "pilot-dasar", title: "Pilot dasar", meta: "Pilot Drone" }] },
        { group: "categories", items: [{ slug: "pilot", title: "Pilot", meta: null, trainingCount: 12 }] },
      ],
    });
  });
});

describe("publicSearch: rate limit per IP", () => {
  it(`permintaan ke-${PUBLIC_SEARCH_MAX + 1} dalam 1 menit = 429 + Retry-After + no-store; IP lain tetap boleh`, async () => {
    const limiter = freshLimiter();
    for (let i = 0; i < PUBLIC_SEARCH_MAX; i++) await publicSearch("drone", meta, now, limiter);
    await expect(publicSearch("drone", meta, now, limiter)).rejects.toMatchObject({
      status: 429,
      code: "TOO_MANY_REQUESTS",
      headers: { "Retry-After": "60", "Cache-Control": "no-store" },
    });
    await expect(publicSearch("drone", { ip: "198.51.100.7" }, now, limiter)).resolves.toBeTruthy();
    // Window lewat: boleh lagi.
    await expect(publicSearch("drone", meta, new Date(now.getTime() + PUBLIC_SEARCH_WINDOW_MS + 1), limiter)).resolves.toBeTruthy();
  });

  it("IP tak terbaca: shared = satu bucket bersama; skip = tidak dibatasi per IP", async () => {
    const shared = freshLimiter();
    for (let i = 0; i < PUBLIC_SEARCH_MAX; i++) await publicSearch("drone", { ip: "unknown", unknownIpMode: "shared" }, now, shared);
    await expect(publicSearch("drone", { ip: "unknown", unknownIpMode: "shared" }, now, shared)).rejects.toMatchObject({ status: 429 });

    const skipped = freshLimiter();
    for (let i = 0; i < PUBLIC_SEARCH_MAX + 5; i++) await publicSearch("drone", { ip: "unknown", unknownIpMode: "skip" }, now, skipped);
    expect(skipped.status("unknown", now.getTime()).blocked).toBe(false);
  });
});
