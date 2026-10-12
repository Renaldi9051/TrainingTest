import { adminRoute } from "@/lib/auth";
import { ok, readJson } from "@/lib/http";
import { parseSearchParams } from "@/lib/list-query";
import { portfolioCreateSchema, portfolioListQuerySchema } from "@/lib/validators/portfolio";
import { createPortfolio, listPortfolio } from "@/services/portfolio";

export const dynamic = "force-dynamic";

export const GET = adminRoute(async (request) => {
  const query = parseSearchParams(portfolioListQuerySchema, request.nextUrl.searchParams);
  const { items, meta } = await listPortfolio(query);
  return ok(items, meta);
});

export const POST = adminRoute(async (request, _context, admin) => {
  const input = portfolioCreateSchema.parse(await readJson(request));
  return ok(await createPortfolio(input, admin.user.id), undefined, 201);
});
