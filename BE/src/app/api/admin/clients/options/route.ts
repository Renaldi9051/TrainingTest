import { adminRoute } from "@/lib/auth";
import { ok } from "@/lib/http";
import { parseSearchParams } from "@/lib/list-query";
import { optionsQuerySchema } from "@/lib/validators/options";
import { listClientOptions } from "@/services/client";

export const dynamic = "force-dynamic";

// ?q=&limit=&ids= (lihat lib/validators/options.ts).
export const GET = adminRoute(async (request) => {
  const query = parseSearchParams(optionsQuerySchema, request.nextUrl.searchParams);
  return ok(await listClientOptions(query));
});
