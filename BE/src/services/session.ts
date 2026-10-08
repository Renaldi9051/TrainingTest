import { createHmac, randomBytes } from "node:crypto";
import { getDb } from "@/lib/db";
import { getEnv } from "@/lib/env";

export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
// Sesi diperpanjang otomatis kalau sisa masa berlakunya kurang dari ini.
export const SESSION_REFRESH_THRESHOLD_MS = 24 * 60 * 60 * 1000;

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  lastLoginAt: Date | null;
};

export type ValidSession = {
  sessionId: string;
  expiresAt: Date;
  // true kalau expiresAt baru saja diperpanjang; cookie perlu di-set ulang.
  extended: boolean;
  user: SessionUser;
};

export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

// Yang disimpan di DB hanya hash token, jadi bocornya isi tabel Session tidak memberi akses.
export function hashSessionToken(token: string): string {
  return createHmac("sha256", getEnv().SESSION_SECRET).update(token).digest("hex");
}

export async function createSession(
  userId: string,
  meta: { ip: string | null; userAgent: string | null },
  now = new Date(),
): Promise<{ token: string; expiresAt: Date }> {
  const token = generateSessionToken();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  await getDb().session.create({
    data: {
      userId,
      tokenHash: hashSessionToken(token),
      expiresAt,
      ip: meta.ip,
      userAgent: meta.userAgent?.slice(0, 512) ?? null,
    },
  });
  return { token, expiresAt };
}

export async function validateSession(
  token: string,
  options: { extend: boolean },
  now = new Date(),
): Promise<ValidSession | null> {
  const db = getDb();
  const session = await db.session.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    select: {
      id: true,
      expiresAt: true,
      user: { select: { id: true, name: true, email: true, active: true, lastLoginAt: true } },
    },
  });
  if (!session) return null;

  if (session.expiresAt.getTime() <= now.getTime()) {
    await db.session.deleteMany({ where: { id: session.id } });
    return null;
  }

  const { active, ...user } = session.user;
  if (!active) {
    // Akun nonaktif kehilangan semua sesinya, bukan hanya sesi yang sedang dipakai.
    await revokeUserSessions(user.id);
    return null;
  }

  let expiresAt = session.expiresAt;
  let extended = false;
  if (options.extend && expiresAt.getTime() - now.getTime() < SESSION_REFRESH_THRESHOLD_MS) {
    expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
    await db.session.update({ where: { id: session.id }, data: { expiresAt } });
    extended = true;
  }

  return { sessionId: session.id, expiresAt, extended, user };
}

// Mengembalikan userId pemilik sesi (untuk audit), atau null kalau sesi tidak ada.
export async function revokeSession(token: string): Promise<string | null> {
  const db = getDb();
  const session = await db.session.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    select: { id: true, userId: true },
  });
  if (!session) return null;
  await db.session.deleteMany({ where: { id: session.id } });
  return session.userId;
}

export async function revokeUserSessions(userId: string): Promise<void> {
  await getDb().session.deleteMany({ where: { userId } });
}
