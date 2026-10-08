// Harus sama dengan BE/src/lib/session-cookie.ts. FE hanya mengecek ada/tidaknya cookie;
// validasi sesi selalu di BE.
export const SESSION_COOKIE = "admin_session";
export const SESSION_PEEK_HEADER = "x-session-peek";

export const ADMIN_HOME = "/admin";
export const ADMIN_LOGIN = "/admin/login";

// Hanya izinkan redirect balik ke halaman admin (cegah open redirect lewat ?next=).
export function safeAdminPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/admin") || next.startsWith("//")) return ADMIN_HOME;
  if (next === ADMIN_LOGIN || next.startsWith(`${ADMIN_LOGIN}?`)) return ADMIN_HOME;
  if (/[\\\s]/.test(next)) return ADMIN_HOME;
  return next;
}
