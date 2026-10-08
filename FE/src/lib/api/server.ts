import "server-only";
import { cookies } from "next/headers";
import { getEnv } from "@/lib/env";
import { SESSION_COOKIE, SESSION_PEEK_HEADER } from "@/lib/session";
import type { ApiSuccess, AuthUser, AuthUserResponse } from "./types";

// Fetch dari server FE langsung ke BE (bukan lewat rewrite), meneruskan cookie sesi admin.
// Header peek: BE tidak memperpanjang sesi di sini, karena Set-Cookie dari BE tidak sampai ke browser.
export async function adminServerFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const headers = new Headers(init?.headers);
  headers.set("Accept", "application/json");
  headers.set(SESSION_PEEK_HEADER, "1");
  if (token) headers.set("Cookie", `${SESSION_COOKIE}=${token}`);

  return fetch(`${getEnv().BE_INTERNAL_URL}/api${path}`, { ...init, headers, cache: "no-store" });
}

// null = tidak ada sesi valid (401). Error lain (BE mati, 5xx) dilempar supaya tampil sebagai error,
// bukan diam-diam mengarahkan ke halaman login.
export async function getCurrentAdmin(): Promise<AuthUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const response = await adminServerFetch("/auth/me");
  if (response.status === 401) return null;
  if (!response.ok) throw new Error(`Gagal memeriksa sesi admin (HTTP ${response.status}).`);

  const body = (await response.json()) as ApiSuccess<AuthUserResponse>;
  return body.data.user;
}
