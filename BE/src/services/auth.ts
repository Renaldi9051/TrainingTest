import { getDb } from "@/lib/db";
import { HttpError } from "@/lib/http";
import { burnPasswordCheck, verifyPassword } from "@/lib/password";
import { getLoginRateLimiter, type RateLimiter } from "@/lib/rate-limit";
import type { LoginInput } from "@/lib/validators/auth";
import { AuditAction, writeAudit } from "@/services/audit";
import { createSession, revokeSession, type SessionUser } from "@/services/session";

// Pesan sama untuk email tidak terdaftar, password salah, dan akun nonaktif.
export const INVALID_CREDENTIALS_MESSAGE = "Email atau kata sandi salah.";

type RequestMeta = { ip: string; userAgent: string | null };

export function loginRateLimitKey(ip: string, email: string): string {
  return `${ip}|${email.toLowerCase()}`;
}

export async function login(
  input: LoginInput,
  meta: RequestMeta,
  limiter: RateLimiter = getLoginRateLimiter(),
): Promise<{ user: SessionUser; token: string; expiresAt: Date }> {
  const key = loginRateLimitKey(meta.ip, input.email);
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
  const user = await db.user.findUnique({
    where: { email: input.email },
    select: { id: true, name: true, email: true, active: true, passwordHash: true },
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
    user: { id: user.id, name: user.name, email: user.email, lastLoginAt },
    ...session,
  };
}

export async function logout(token: string | undefined, meta: RequestMeta): Promise<void> {
  if (!token) return;
  const userId = await revokeSession(token);
  if (!userId) return;
  await writeAudit({ userId, action: AuditAction.LOGOUT, entity: "Session", diff: { ip: meta.ip } });
}
