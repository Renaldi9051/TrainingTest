import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRateLimiter } from "@/lib/rate-limit";
import { createMockDb, type MockDb } from "@/test/mock-db";

const db = vi.hoisted(() => ({ current: undefined as unknown }));
vi.mock("@/lib/db", () => ({ getDb: () => db.current }));

import { hashPassword } from "@/lib/password";
import { INVALID_CREDENTIALS_MESSAGE, login, logout } from "@/services/auth";
import { hashSessionToken } from "@/services/session";

const meta = { ip: "10.0.0.1", userAgent: "vitest" };
const CORRECT = "password-benar-123";
let mock: MockDb;
let passwordHash: string;

beforeAll(async () => {
  passwordHash = await hashPassword(CORRECT);
});

beforeEach(() => {
  mock = createMockDb();
  db.current = mock;
});

const activeUser = () => ({
  id: "u1",
  name: "Admin",
  active: true,
  passwordHash,
});

const freshLimiter = () => new MemoryRateLimiter(5, 15 * 60_000);

describe("login", () => {
  it("sukses: update lastLoginAt, buat sesi, tulis audit LOGIN", async () => {
    mock.user.findFirst.mockResolvedValue(activeUser());
    const result = await login(
      { password: CORRECT },
      meta,
      freshLimiter(),
    );
    expect(result.user).toEqual({ id: "u1", name: "Admin", lastLoginAt: expect.any(Date) });
    expect(mock.user.findFirst.mock.calls[0][0]).toMatchObject({ orderBy: { createdAt: "asc" } });
    expect(result.user).not.toHaveProperty("passwordHash");
    expect(mock.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { lastLoginAt: expect.any(Date) },
    });
    expect(mock.session.create.mock.calls[0][0].data.tokenHash).toBe(
      hashSessionToken(result.token),
    );
    expect(mock.auditLog.create.mock.calls[0][0].data).toMatchObject({
      action: "LOGIN",
      userId: "u1",
    });
  });

  it.each([
    ["password salah", () => activeUser(), "password-salah-123"],
    ["admin belum dibuat", () => null, CORRECT],
    ["akun nonaktif", () => ({ ...activeUser(), active: false }), CORRECT],
  ])("%s: 401 dengan pesan yang sama", async (_label, found, password) => {
    mock.user.findFirst.mockResolvedValue(found());
    await expect(
      login({ password }, meta, freshLimiter()),
    ).rejects.toMatchObject({ status: 401, message: INVALID_CREDENTIALS_MESSAGE });
    expect(mock.session.create).not.toHaveBeenCalled();
  });

  it("429 setelah 5 kali gagal dari IP yang sama, walau password benar", async () => {
    const limiter = freshLimiter();
    mock.user.findFirst.mockResolvedValue(activeUser());
    for (let i = 0; i < 5; i++) {
      await expect(
        login({ password: "salah-salah-123" }, meta, limiter),
      ).rejects.toMatchObject({ status: 401 });
    }
    await expect(
      login({ password: CORRECT }, meta, limiter),
    ).rejects.toMatchObject({ status: 429, code: "TOO_MANY_ATTEMPTS" });

    // IP lain tidak ikut terblokir.
    await expect(
      login({ password: CORRECT }, { ...meta, ip: "10.0.0.2" }, limiter),
    ).resolves.toMatchObject({ user: { id: "u1" } });
  });
});

describe("logout", () => {
  it("IP tak terbaca, mode skip: login tetap dibatasi lewat bucket bersama (tidak pernah dilewati)", async () => {
    const limiter = freshLimiter();
    mock.user.findFirst.mockResolvedValue(activeUser());
    const anon = { ip: "unknown", userAgent: "vitest", unknownIpMode: "skip" } as const;
    for (let i = 0; i < 5; i++) {
      await expect(login({ password: "salah-salah-123" }, anon, limiter)).rejects.toMatchObject({ status: 401 });
    }
    await expect(login({ password: CORRECT }, anon, limiter)).rejects.toMatchObject({ status: 429 });
  });

  it("menghapus sesi dan menulis audit LOGOUT", async () => {
    mock.session.findUnique.mockResolvedValue({ id: "s1", userId: "u1" });
    await logout("token", meta);
    expect(mock.session.deleteMany).toHaveBeenCalledWith({ where: { id: "s1" } });
    expect(mock.auditLog.create.mock.calls[0][0].data).toMatchObject({
      action: "LOGOUT",
      userId: "u1",
    });
  });

  it("tanpa token atau sesi tidak dikenal: tidak melakukan apa-apa", async () => {
    await logout(undefined, meta);
    mock.session.findUnique.mockResolvedValue(null);
    await logout("tidak-ada", meta);
    expect(mock.auditLog.create).not.toHaveBeenCalled();
  });
});
