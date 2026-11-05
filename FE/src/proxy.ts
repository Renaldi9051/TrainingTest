import { NextResponse, type NextRequest } from "next/server";
import type { PublicRedirect } from "@/lib/api/public";
import { parseCatalogState } from "@/lib/catalog-url";
import { getPublicEnv } from "@/lib/env";
import { ADMIN_LOGIN, PREVIEW_EXIT, SESSION_COOKIE } from "@/lib/session";

const CATALOG = "/pelatihan";

export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === CATALOG) return redirectCategoryParam(request);
  return adminGuard(request);
}

// Kategori tidak lagi memfilter katalog (keputusan atasan 4 Nov 2026): /pelatihan?kategori=<slug>
// dialihkan 308 ke /pelatihan/kategori/<slug>, parameter lain dibuang, >1 kategori ambil yang pertama.
// Slug tak dikenal: ikuti tabel Redirect (slug lama), selain itu 308 ke /pelatihan.
// Di proxy (bukan di page) supaya status 308 terkirim sebelum streaming dan halaman katalog tetap
// bisa di-prerender (Cache Components melarang membaca searchParams di luar <Suspense>).
async function redirectCategoryParam(request: NextRequest) {
  if (!request.nextUrl.searchParams.has("kategori")) return NextResponse.next();
  const slug = parseCatalogState({ kategori: request.nextUrl.searchParams.get("kategori") ?? "" }).kategori[0];
  const landing = `${CATALOG}/kategori/${slug}`;
  if (!slug) return NextResponse.redirect(new URL(CATALOG, request.url), 308);

  const base = `${getPublicEnv().BE_INTERNAL_URL}/api/public`;
  const get = (path: string) => fetch(`${base}${path}`, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(5_000) });
  try {
    const category = await get(`/categories/${slug}`);
    if (category.status === 404) {
      const redirect = await get(`/redirects?path=${encodeURIComponent(landing)}`);
      const target = redirect.ok ? ((await redirect.json()) as { data: PublicRedirect | null }).data : null;
      if (target) return NextResponse.redirect(new URL(target.to, request.url), target.permanent ? 308 : 307);
      return NextResponse.redirect(new URL(CATALOG, request.url), 308);
    }
  } catch {
    // BE tidak terjangkau: tetap alihkan ke halaman kategori (halaman itu yang menampilkan error).
  }
  return NextResponse.redirect(new URL(landing, request.url), 308);
}

// Saringan cepat saja: tanpa cookie sesi, halaman admin diarahkan ke login.
// Validasi sesi yang sebenarnya ada di layout admin (GET /api/auth/me) dan di setiap endpoint BE.
function adminGuard(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  // Keluar dari mode pratinjau harus tetap bisa walau sesi admin sudah habis.
  if (pathname === ADMIN_LOGIN || pathname === PREVIEW_EXIT) return NextResponse.next();
  if (request.cookies.has(SESSION_COOKIE)) return NextResponse.next();

  const loginUrl = new URL(ADMIN_LOGIN, request.url);
  loginUrl.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
}

// Halaman admin + katalog (hanya untuk redirect ?kategori=). /api/* sengaja tidak lewat proxy
// supaya body upload tidak di-buffer.
export const config = {
  matcher: ["/admin", "/admin/:path*", "/pelatihan"],
};
