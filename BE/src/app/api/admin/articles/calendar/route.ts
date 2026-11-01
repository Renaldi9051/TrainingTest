import { adminRoute } from "@/lib/auth";
import { ok } from "@/lib/http";
import { parseSearchParams } from "@/lib/list-query";
import { articleCalendarQuerySchema } from "@/lib/validators/article";
import { listArticleCalendar } from "@/services/article";

export const dynamic = "force-dynamic";

// ?month=2026-11: artikel tayang & terjadwal di bulan itu (WIB), untuk kalender admin.
export const GET = adminRoute(async (request) => {
  const query = parseSearchParams(articleCalendarQuerySchema, request.nextUrl.searchParams);
  return ok(await listArticleCalendar(query));
});
