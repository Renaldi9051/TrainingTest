import { adminRoute } from "@/lib/auth";
import { ok } from "@/lib/http";
import { parseSearchParams } from "@/lib/list-query";
import { adminSearchQuerySchema } from "@/lib/validators/search";
import { adminSearch } from "@/services/admin-search";

export const dynamic = "force-dynamic";

// Search global admin (Ctrl/Cmd+K): ?q= 2-100 karakter. Hasil per grup (maks 5), tanpa item di Sampah.
export const GET = adminRoute(async (request) => {
  const { q } = parseSearchParams(adminSearchQuerySchema, request.nextUrl.searchParams);
  return ok(await adminSearch(q));
});
