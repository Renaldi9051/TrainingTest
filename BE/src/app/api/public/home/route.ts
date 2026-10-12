import { ok, route } from "@/lib/http";
import { getPublicHome } from "@/services/home-section";

export const dynamic = "force-dynamic";

// Beranda: section yang tampil dan tidak kosong, sudah di-resolve (id dihapus/draft tersaring).
export const GET = route(async () => ok(await getPublicHome()));
