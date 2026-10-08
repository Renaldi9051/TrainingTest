import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockDb, type MockDb } from "@/test/mock-db";

const db = vi.hoisted(() => ({ current: undefined as unknown }));
vi.mock("@/lib/db", () => ({ getDb: () => db.current }));

import { adminRoute, requireAdmin } from "@/lib/auth";
import { ok } from "@/lib/http";
import { SESSION_COOKIE } from "@/lib/session-cookie";

const DAY = 24 * 60 * 60 * 1000;
const user = { id: "u1", name: "Admin", email: "admin@example.com", active: true, lastLoginAt: null };

let mock: MockDb;

beforeEach(() => {
  mock = createMockDb();
  db.current = mock;
});

function request(init: { cookie?: string; method?: string; headers?: Record<string, string> } = {}) {
  const headers = new Headers(init.headers);
  if (init.cookie) headers.set("cookie", `${SESSION_COOKIE}=${init.cookie}`);
  return new NextRequest("http://localhost:4000/api/admin/test", {
    method: init.method ?? "GET",
    headers,
  });
}

function sessionExpiringIn(ms: number, overrides: Partial<typeof user> = {}) {
  return { id: "s1", expiresAt: new Date(Date.now() + ms), user: { ...user, ...overrides } };
}

describe("requireAdmin", () => {
  it("401 tanpa cookie, tanpa menyentuh DB", async () => {
    await expect(requireAdmin(request())).rejects.toMatchObject({ status: 401 });
    expect(mock.session.findUnique).not.toHaveBeenCalled();
  });

  it("401 kalau sesi kedaluwarsa", async () => {
    mock.session.findUnique.mockResolvedValue(sessionExpiringIn(-1000));
    await expect(requireAdmin(request({ cookie: "token" }))).rejects.toMatchObject({ status: 401 });
  });

  it("401 kalau user nonaktif, dan semua sesinya dihapus", async () => {
    mock.session.findUnique.mockResolvedValue(sessionExpiringIn(3 * DAY, { active: false }));
    await expect(requireAdmin(request({ cookie: "token" }))).rejects.toMatchObject({ status: 401 });
    expect(mock.session.deleteMany).toHaveBeenCalledWith({ where: { userId: "u1" } });
  });

  it("mengembalikan user kalau sesi valid", async () => {
    mock.session.findUnique.mockResolvedValue(sessionExpiringIn(3 * DAY));
    const admin = await requireAdmin(request({ cookie: "token" }));
    expect(admin.user).toEqual({
      id: "u1",
      name: "Admin",
      email: "admin@example.com",
      lastLoginAt: null,
    });
  });
});

describe("adminRoute", () => {
  const handler = adminRoute(async () => ok({ hello: "dunia" }));

  it("tanpa sesi: 401 dengan format error standar", async () => {
    const response = await handler(request({ method: "POST" }), {});
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: { code: "UNAUTHORIZED", message: expect.any(String) },
    });
  });

  it("sesi valid tapi Origin asing pada mutasi: 403", async () => {
    mock.session.findUnique.mockResolvedValue(sessionExpiringIn(3 * DAY));
    const response = await handler(
      request({ cookie: "token", method: "POST", headers: { origin: "https://jahat.example" } }),
      {},
    );
    expect(response.status).toBe(403);
  });

  it("memperbarui cookie kalau sesi diperpanjang", async () => {
    mock.session.findUnique.mockResolvedValue(sessionExpiringIn(60_000));
    const response = await handler(request({ cookie: "token" }), {});
    expect(response.status).toBe(200);
    const setCookie = (response.headers.get("set-cookie") ?? "").toLowerCase();
    expect(setCookie).toContain(`${SESSION_COOKIE}=token`);
    expect(setCookie).toContain("httponly");
    expect(setCookie).toContain("samesite=lax");
    expect(setCookie).toContain("path=/");
  });

  it("request peek dari FE server tidak memperpanjang sesi", async () => {
    mock.session.findUnique.mockResolvedValue(sessionExpiringIn(60_000));
    const response = await handler(
      request({ cookie: "token", headers: { "x-session-peek": "1" } }),
      {},
    );
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(mock.session.update).not.toHaveBeenCalled();
  });
});
