import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_LOGIN, SESSION_COOKIE } from "@/lib/session";

// Saringan cepat saja: tanpa cookie sesi, halaman admin diarahkan ke login.
// Validasi sesi yang sebenarnya ada di layout admin (GET /api/auth/me) dan di setiap endpoint BE.
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (pathname === ADMIN_LOGIN) return NextResponse.next();
  if (request.cookies.has(SESSION_COOKIE)) return NextResponse.next();

  const loginUrl = new URL(ADMIN_LOGIN, request.url);
  loginUrl.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
}

// Hanya halaman admin. /api/* sengaja tidak lewat proxy supaya body upload tidak di-buffer.
export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
