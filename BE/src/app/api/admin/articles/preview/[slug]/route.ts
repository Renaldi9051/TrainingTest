import { adminRoute } from "@/lib/auth";
import { HttpError, ok } from "@/lib/http";
import { slugSchema } from "@/lib/slug";
import { getArticlePreview } from "@/services/article-public";

export const dynamic = "force-dynamic";

type Context = RouteContext<"/api/admin/articles/preview/[slug]">;

// Pratinjau draft untuk FE (draft mode): bentuk sama dengan detail publik, termasuk draf/terjadwal.
export const GET = adminRoute<Context>(async (_request, context) => {
  const parsed = slugSchema.safeParse((await context.params).slug);
  const article = parsed.success ? await getArticlePreview(parsed.data) : null;
  if (!article) throw new HttpError(404, "NOT_FOUND", "Artikel tidak ditemukan.");
  return ok(article);
});
