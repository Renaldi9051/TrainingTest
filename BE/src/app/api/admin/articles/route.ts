import { adminRoute } from "@/lib/auth";
import { ok, readJson } from "@/lib/http";
import { parseSearchParams } from "@/lib/list-query";
import { articleCreateSchema, articleListQuerySchema } from "@/lib/validators/article";
import { createArticle, listArticles } from "@/services/article";

export const dynamic = "force-dynamic";

export const GET = adminRoute(async (request) => {
  const query = parseSearchParams(articleListQuerySchema, request.nextUrl.searchParams);
  const { items, meta } = await listArticles(query);
  return ok(items, meta);
});

export const POST = adminRoute(async (request, _context, admin) => {
  const input = articleCreateSchema.parse(await readJson(request));
  return ok(await createArticle(input, admin.user.id), undefined, 201);
});
