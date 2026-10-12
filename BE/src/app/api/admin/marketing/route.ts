import { adminRoute } from "@/lib/auth";
import { ok, readJson } from "@/lib/http";
import { parseSearchParams } from "@/lib/list-query";
import { marketingCreateSchema, marketingListQuerySchema } from "@/lib/validators/marketing";
import { createMarketing, listMarketing } from "@/services/marketing";

export const dynamic = "force-dynamic";

export const GET = adminRoute(async (request) => {
  const query = parseSearchParams(marketingListQuerySchema, request.nextUrl.searchParams);
  const { items, meta } = await listMarketing(query);
  return ok(items, meta);
});

export const POST = adminRoute(async (request, _context, admin) => {
  const input = marketingCreateSchema.parse(await readJson(request));
  return ok(await createMarketing(input, admin.user.id), undefined, 201);
});
