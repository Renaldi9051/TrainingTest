import { getDb } from "@/lib/db";
import { HttpError } from "@/lib/http";
import { burnPasswordCheck, verifyPassword } from "@/lib/password";
import { getLoginRateLimiter, ipRateLimitKey, type RateLimiter, type UnknownIpMode } from "@/lib/rate-limit";
import { UNKNOWN_IP } from "@/lib/request";
import type { LoginInput } from "@/lib/validators/auth";
import { AuditAction, writeAudit } from "@/services/audit";
import { createSession, revokeSession, type SessionUser } from "@/services/session";

// Pesan sama untuk password salah, admin belum dibuat, dan akun nonaktif.
export const INVALID_CREDENTIALS_MESSAGE = "Kata sandi salah.";

type RequestMeta = { ip: string; userAgent: string | null; unknownIpMode?: UnknownIpMode };

export async function login(
  input: LoginInput,
  meta: RequestMeta,
  limiter: RateLimiter = getLoginRateLimiter(),
): Promise<{ user: SessionUser; token: string; expiresAt: Date }> {
  // Key = IP. IP tak terbaca selalu jadi "unknown" (juga di mode "skip"): limit login tidak pernah
  // dilewati, paling tidak semua IP tak terbaca berbagi satu bucket, supaya tetap terlindung dari
  // tebak kata sandi.
  const key = ipRateLimitKey(meta.ip, meta.unknownIpMode ?? "shared") ?? UNKNOWN_IP;
  const limit = limiter.status(key);
  if (limit.blocked) {
    const minutes = Math.max(1, Math.ceil(limit.retryAfterMs / 60_000));
    throw new HttpError(
      429,
      "TOO_MANY_ATTEMPTS",
      `Terlalu banyak percobaan masuk. Coba lagi dalam ${minutes} menit.`,
    );
  }

  const db = getDb();
  // Satu admin: akun yang paling awal dibuat (admin dari seed).
  const user = await db.user.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, active: true, passwordHash: true },
  });

  let valid = false;
  if (user) valid = await verifyPassword(user.passwordHash, input.password);
  else await burnPasswordCheck(input.password);

  if (!user || !valid || !user.active) {
    limiter.recordFailure(key);
    throw new HttpError(401, "INVALID_CREDENTIALS", INVALID_CREDENTIALS_MESSAGE);
  }

  limiter.reset(key);
  const lastLoginAt = new Date();
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt } });
  const session = await createSession(user.id, { ip: meta.ip, userAgent: meta.userAgent });
  await writeAudit({
    userId: user.id,
    action: AuditAction.LOGIN,
    entity: "Session",
    diff: { ip: meta.ip },
  });

  return {
    user: { id: user.id, name: user.name, lastLoginAt },
    ...session,
  };
}

export async function logout(token: string | undefined, meta: RequestMeta): Promise<void> {
  if (!token) return;
  const userId = await revokeSession(token);
  if (!userId) return;
  await writeAudit({ userId, action: AuditAction.LOGOUT, entity: "Session", diff: { ip: meta.ip } });
}
