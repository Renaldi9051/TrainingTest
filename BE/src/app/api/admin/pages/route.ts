import { adminRoute } from "@/lib/auth";
import { ok, readJson } from "@/lib/http";
import { parseSearchParams } from "@/lib/list-query";
import { pageCreateSchema, pageListQuerySchema } from "@/lib/validators/page";
import { createPage, listPages } from "@/services/page";

export const dynamic = "force-dynamic";

export const GET = adminRoute(async (request) => {
  const query = parseSearchParams(pageListQuerySchema, request.nextUrl.searchParams);
  const { items, meta } = await listPages(query);
  return ok(items, meta);
});

export const POST = adminRoute(async (request, _context, admin) => {
  const input = pageCreateSchema.parse(await readJson(request));
  return ok(await createPage(input, admin.user.id), undefined, 201);
});
