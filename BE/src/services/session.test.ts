import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockDb, type MockDb } from "@/test/mock-db";

const db = vi.hoisted(() => ({ current: undefined as unknown }));
vi.mock("@/lib/db", () => ({ getDb: () => db.current }));

import {
  SESSION_TTL_MS,
  createSession,
  generateSessionToken,
  hashSessionToken,
  validateSession,
} from "@/services/session";

const NOW = new Date("2026-10-08T10:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
const activeUser = {
  id: "u1",
  name: "Admin",
  email: "admin@example.com",
  active: true,
  lastLoginAt: null,
};

let mock: MockDb;

beforeEach(() => {
  mock = createMockDb();
  db.current = mock;
});

describe("token sesi", () => {
  it("token acak 32 byte (base64url) dan berbeda tiap kali", () => {
    const token = generateSessionToken();
    expect(Buffer.from(token, "base64url")).toHaveLength(32);
    expect(generateSessionToken()).not.toBe(token);
  });

  it("hash HMAC-SHA256 deterministik dan tidak sama dengan token", () => {
    const token = generateSessionToken();
    expect(hashSessionToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashSessionToken(token)).toBe(hashSessionToken(token));
    expect(hashSessionToken(token)).not.toContain(token);
  });
});

describe("createSession", () => {
  it("menyimpan hash token (bukan token asli) dengan masa berlaku 7 hari", async () => {
    const { token, expiresAt } = await createSession("u1", { ip: "1.2.3.4", userAgent: "UA" }, NOW);
    expect(expiresAt.getTime()).toBe(NOW.getTime() + SESSION_TTL_MS);
    const data = mock.session.create.mock.calls[0][0].data;
    expect(data.tokenHash).toBe(hashSessionToken(token));
    expect(JSON.stringify(data)).not.toContain(token);
    expect(data).toMatchObject({ userId: "u1", ip: "1.2.3.4", userAgent: "UA", expiresAt });
  });
});

describe("validateSession", () => {
  it("mengembalikan null kalau token tidak dikenal", async () => {
    mock.session.findUnique.mockResolvedValue(null);
    expect(await validateSession("x", { extend: true }, NOW)).toBeNull();
  });

  it("menghapus dan menolak sesi kedaluwarsa", async () => {
    mock.session.findUnique.mockResolvedValue({
      id: "s1",
      expiresAt: new Date(NOW.getTime() - 1),
      user: activeUser,
    });
    expect(await validateSession("x", { extend: true }, NOW)).toBeNull();
    expect(mock.session.deleteMany).toHaveBeenCalledWith({ where: { id: "s1" } });
  });

  it("user nonaktif: semua sesinya dihapus", async () => {
    mock.session.findUnique.mockResolvedValue({
      id: "s1",
      expiresAt: new Date(NOW.getTime() + 3 * DAY),
      user: { ...activeUser, active: false },
    });
    expect(await validateSession("x", { extend: true }, NOW)).toBeNull();
    expect(mock.session.deleteMany).toHaveBeenCalledWith({ where: { userId: "u1" } });
  });

  it("tidak memperpanjang kalau sisa >= 1 hari", async () => {
    const expiresAt = new Date(NOW.getTime() + 2 * DAY);
    mock.session.findUnique.mockResolvedValue({ id: "s1", expiresAt, user: activeUser });
    const result = await validateSession("x", { extend: true }, NOW);
    expect(result).toMatchObject({ extended: false, expiresAt, user: { id: "u1" } });
    expect(result?.user).not.toHaveProperty("active");
    expect(mock.session.update).not.toHaveBeenCalled();
  });

  it("memperpanjang 7 hari dari sekarang kalau sisa < 1 hari", async () => {
    mock.session.findUnique.mockResolvedValue({
      id: "s1",
      expiresAt: new Date(NOW.getTime() + DAY - 1),
      user: activeUser,
    });
    const result = await validateSession("x", { extend: true }, NOW);
    const extendedTo = new Date(NOW.getTime() + SESSION_TTL_MS);
    expect(result).toMatchObject({ extended: true, expiresAt: extendedTo });
    expect(mock.session.update).toHaveBeenCalledWith({
      where: { id: "s1" },
      data: { expiresAt: extendedTo },
    });
  });

  it("tidak memperpanjang saat extend: false (request peek dari FE server)", async () => {
    mock.session.findUnique.mockResolvedValue({
      id: "s1",
      expiresAt: new Date(NOW.getTime() + 60_000),
      user: activeUser,
    });
    const result = await validateSession("x", { extend: false }, NOW);
    expect(result?.extended).toBe(false);
    expect(mock.session.update).not.toHaveBeenCalled();
  });
});
