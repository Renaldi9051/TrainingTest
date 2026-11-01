import { adminRoute } from "@/lib/auth";
import { ok, readJson } from "@/lib/http";
import { articleCategoryCreateSchema } from "@/lib/validators/article";
import { createArticleCategory, listArticleCategories } from "@/services/article-category";

export const dynamic = "force-dynamic";

export const GET = adminRoute(async () => ok(await listArticleCategories()));

export const POST = adminRoute(async (request, _context, admin) => {
  const input = articleCategoryCreateSchema.parse(await readJson(request));
  return ok(await createArticleCategory(input, admin.user.id), undefined, 201);
});
