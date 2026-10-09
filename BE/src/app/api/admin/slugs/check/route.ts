import { adminRoute } from "@/lib/auth";
import { ok } from "@/lib/http";
import { parseSearchParams } from "@/lib/list-query";
import { slugCheckQuerySchema } from "@/lib/validators/slug-check";
import { checkSlug } from "@/services/slug-check";

export const dynamic = "force-dynamic";

export const GET = adminRoute(async (request) => {
  const query = parseSearchParams(slugCheckQuerySchema, request.nextUrl.searchParams);
  return ok(await checkSlug(query));
});
