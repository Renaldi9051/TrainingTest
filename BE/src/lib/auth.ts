import type { NextRequest, NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { HttpError, route } from "@/lib/http";
import { assertAllowedOrigin, getClientIp } from "@/lib/request";
import { SESSION_COOKIE, SESSION_PEEK_HEADER, setSessionCookie } from "@/lib/session-cookie";
import { validateSession, type ValidSession } from "@/services/session";

export type AdminContext = ValidSession & { token: string };

const UNAUTHORIZED_MESSAGE = "Sesi tidak valid atau sudah berakhir. Silakan masuk lagi.";

// Wajib dipanggil di setiap endpoint admin. Gagal = HttpError 401 (format error standar).
export async function requireAdmin(
  request: Pick<NextRequest, "cookies" | "headers">,
): Promise<AdminContext> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) throw new HttpError(401, "UNAUTHORIZED", UNAUTHORIZED_MESSAGE);

  const session = await validateSession(token, {
    extend: request.headers.get(SESSION_PEEK_HEADER) !== "1",
  });
  if (!session) throw new HttpError(401, "UNAUTHORIZED", UNAUTHORIZED_MESSAGE);

  return { ...session, token };
}

export function requestMeta(request: NextRequest) {
  return {
    ip: getClientIp(request.headers, getEnv().TRUST_PROXY_HOPS),
    userAgent: request.headers.get("user-agent"),
  };
}

// Route handler admin: sesi dicek dulu (401), lalu Origin untuk request mutasi (403).
// Kalau sesi diperpanjang, cookie di respons ikut diperbarui.
export function adminRoute<TContext>(
  handler: (request: NextRequest, context: TContext, admin: AdminContext) => Promise<NextResponse>,
) {
  return route<TContext>(async (request, context) => {
    const admin = await requireAdmin(request);
    assertAllowedOrigin(request, getEnv().ALLOWED_ORIGINS);
    const response = await handler(request, context, admin);
    if (admin.extended) setSessionCookie(response, admin.token, admin.expiresAt);
    return response;
  });
}
