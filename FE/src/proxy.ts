import { NextResponse, type NextRequest } from "next/server";
import type { PublicRedirect } from "@/lib/api/public";
import { firstCategorySlug, legacyCatalogTarget } from "@/lib/category-grid-url";
import { getPublicEnv } from "@/lib/env";
import { ADMIN_LOGIN, PREVIEW_EXIT, SESSION_COOKIE } from "@/lib/session";

const CATALOG = "/pelatihan";

export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === CATALOG) return redirectLegacyCatalog(request);
  return adminGuard(request);
}

// /pelatihan sekarang grid kategori (keputusan atasan 5 Nov 2026). URL katalog kartu lama:
// - ?kategori=<slug> -> 308 ke /pelatihan/kategori/<slug> (lihat redirectCategoryParam);
// - ?metode=, ?tipe=, ?sort=/?urut=, ?hal= -> 308 ke /pelatihan, q dan page dipertahankan.
// Di proxy (bukan di page) supaya status 308 terkirim sebelum streaming dan halaman tetap bisa
// di-prerender (Cache Components melarang membaca searchParams di luar <Suspense>).
async function redirectLegacyCatalog(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  if (params.has("kategori")) return redirectCategoryParam(request, firstCategorySlug(params.get("kategori")));
  const target = legacyCatalogTarget(params);
  return target ? NextResponse.redirect(new URL(target, request.url), 308) : NextResponse.next();
}

// ?kategori=: parameter lain dibuang, >1 kategori ambil yang pertama. Slug tak dikenal: ikuti tabel
// Redirect (slug lama), selain itu 308 ke /pelatihan.
async function redirectCategoryParam(request: NextRequest, slug: string | null) {
  if (!slug) return NextResponse.redirect(new URL(CATALOG, request.url), 308);
  const landing = `${CATALOG}/kategori/${slug}`;

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

// Halaman admin + /pelatihan (hanya untuk redirect URL katalog lama). /api/* sengaja tidak lewat
// proxy supaya body upload tidak di-buffer.
export const config = {
  matcher: ["/admin", "/admin/:path*", "/pelatihan"],
};
