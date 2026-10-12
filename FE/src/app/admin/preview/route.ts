import { draftMode } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { adminServerFetch } from "@/lib/api/server";
import type { ApiSuccess } from "@/lib/api/types";
import { ADMIN_LOGIN } from "@/lib/session";

// Konten yang bisa dipratinjau: endpoint admin untuk cek sesi + ambil slug, dan path publiknya.
type PreviewData = { slug: string; kind?: "STANDARD" | "PROFILE" };

const TARGETS = {
  training: {
    endpoint: (id: string) => `/admin/trainings/${id}`,
    path: (data: PreviewData) => `/pelatihan/${data.slug}`,
  },
  service: {
    endpoint: (id: string) => `/admin/services/${id}`,
    path: (data: PreviewData) => `/layanan/${data.slug}`,
  },
  // Halaman profil punya route sendiri (/profil); halaman lain di /[slug].
  page: {
    endpoint: (id: string) => `/admin/pages/${id}`,
    path: (data: PreviewData) => (data.kind === "PROFILE" ? "/profil" : `/${data.slug}`),
  },
} as const;

const querySchema = z.object({ type: z.enum(["training", "service", "page"]), id: z.uuid() });

// Pratinjau konten sebelum tayang (draft mode Next). Hanya untuk sesi admin yang valid:
// sesi dicek ke BE lewat endpoint admin, baru draft mode dinyalakan. Redirect selalu ke path yang
// dibentuk dari data BE (bukan dari query), jadi tidak ada open redirect.
export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return new NextResponse("Parameter pratinjau tidak valid.", { status: 400 });
  const target = TARGETS[parsed.data.type];

  const response = await adminServerFetch(target.endpoint(parsed.data.id));
  if (response.status === 401) {
    const login = new URL(ADMIN_LOGIN, request.url);
    login.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(login);
  }
  if (!response.ok) return new NextResponse("Konten tidak ditemukan.", { status: response.status === 404 ? 404 : 502 });

  const { data } = (await response.json()) as ApiSuccess<PreviewData>;
  (await draftMode()).enable();
  return NextResponse.redirect(new URL(target.path(data), request.url));
}
