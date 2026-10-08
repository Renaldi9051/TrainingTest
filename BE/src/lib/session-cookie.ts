import type { NextResponse } from "next/server";

// Nama yang sama dipakai FE (FE/src/proxy.ts) untuk cek ada/tidaknya sesi.
export const SESSION_COOKIE = "admin_session";

// FE server (layout admin) mengirim header ini saat memanggil BE. Respons ke FE server tidak
// sampai ke browser, jadi sesi tidak boleh diperpanjang di request itu (cookie tidak ikut diperbarui).
export const SESSION_PEEK_HEADER = "x-session-peek";

const baseCookie = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

export function setSessionCookie(response: NextResponse, token: string, expiresAt: Date): void {
  response.cookies.set(SESSION_COOKIE, token, { ...baseCookie, expires: expiresAt });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE, "", { ...baseCookie, expires: new Date(0) });
}
