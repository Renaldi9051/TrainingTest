import { HttpError, ok, route } from "@/lib/http";
import { slugSchema } from "@/lib/slug";
import { getPublicArticle } from "@/services/article-public";

export const dynamic = "force-dynamic";

type Context = RouteContext<"/api/public/articles/[slug]">;

export const GET = route<Context>(async (_request, context) => {
  const parsed = slugSchema.safeParse((await context.params).slug);
  const article = parsed.success ? await getPublicArticle(parsed.data) : null;
  if (!article) throw new HttpError(404, "NOT_FOUND", "Artikel tidak ditemukan.");
  return ok(article);
});
