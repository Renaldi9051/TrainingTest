import { ok, route } from "@/lib/http";
import { publicArticleQuerySchema } from "@/lib/validators/article";
import { listPublicArticles } from "@/services/article-public";

export const dynamic = "force-dynamic";

// ?kategori=teknologi&hal=2
export const GET = route(async (request) => {
  const query = publicArticleQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
  const { items, meta } = await listPublicArticles(query);
  return ok(items, meta);
});
