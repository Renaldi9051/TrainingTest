import { adminRoute } from "@/lib/auth";
import { ok } from "@/lib/http";
import { getHomePreview } from "@/services/home-section";

export const dynamic = "force-dynamic";

// Pratinjau beranda (draft mode): semua section belum dihapus dengan data ter-resolve, termasuk
// yang disembunyikan (visible: false) dan yang kosong (empty: true, tidak tampil di publik).
export const GET = adminRoute(async () => ok(await getHomePreview()));
