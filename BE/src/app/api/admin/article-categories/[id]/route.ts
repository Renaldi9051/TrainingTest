import { adminRoute } from "@/lib/auth";
import { ok, readJson } from "@/lib/http";
import { articleCategoryUpdateSchema } from "@/lib/validators/article";
import { idSchema } from "@/lib/validators/common";
import { deleteArticleCategory, updateArticleCategory } from "@/services/article-category";

export const dynamic = "force-dynamic";

type Context = RouteContext<"/api/admin/article-categories/[id]">;

export const PATCH = adminRoute<Context>(async (request, context, admin) => {
  const id = idSchema.parse((await context.params).id);
  const input = articleCategoryUpdateSchema.parse(await readJson(request));
  return ok(await updateArticleCategory(id, input, admin.user.id));
});

export const DELETE = adminRoute<Context>(async (_request, context, admin) => {
  const id = idSchema.parse((await context.params).id);
  await deleteArticleCategory(id, admin.user.id);
  return ok({ deleted: true });
});
