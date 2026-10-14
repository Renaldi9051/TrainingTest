import { requestMeta } from "@/lib/auth";
import { ok, route } from "@/lib/http";
import { parseSearchParams } from "@/lib/list-query";
import { publicSearchQuerySchema } from "@/lib/validators/search";
import { publicSearch } from "@/services/public-search";

export const dynamic = "force-dynamic";

// Search publik (palette Ctrl/Cmd+K): ?q= 2-100 karakter, rate limit per IP (429 + Retry-After, no-store).
// Cache browser singkat: hasil sama untuk semua pengunjung, jadi boleh public; perubahan tayang
// terlihat paling lambat ~1 menit, dan mengetik ulang kata yang sama tidak memanggil BE lagi.
// Tidak lewat cache bertag FE: request dari server FE ke BE kehilangan IP pengunjung (rate limit).
export const GET = route(async (request) => {
  const { q } = parseSearchParams(publicSearchQuerySchema, request.nextUrl.searchParams);
  const { ip, unknownIpMode } = requestMeta(request);
  const response = ok(await publicSearch(q, { ip, unknownIpMode }));
  response.headers.set("Cache-Control", "public, max-age=30, stale-while-revalidate=30");
  return response;
});
