import { afterEach, describe, expect, it, vi } from "vitest";

const queryRaw = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({ getDb: () => ({ $queryRaw: queryRaw }) }));

const { GET } = await import("./route");

afterEach(() => {
  vi.restoreAllMocks();
  queryRaw.mockReset();
});

describe("GET /api/health", () => {
  it("mengembalikan 200 dengan status db ok saat database terhubung", async () => {
    queryRaw.mockResolvedValue([{ "?column?": 1 }]);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: { status: "ok", db: "ok" } });
  });

  it("mengembalikan 503 dengan format error standar saat database mati", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    queryRaw.mockRejectedValue(new Error("connect ECONNREFUSED 127.0.0.1:5433"));

    const response = await GET();

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: { code: "DB_UNAVAILABLE", message: "Database tidak dapat dihubungi." },
    });
  });
});
