import { adminRoute } from "@/lib/auth";
import { ok, readJson } from "@/lib/http";
import { articleUpdateSchema } from "@/lib/validators/article";
import { idSchema } from "@/lib/validators/common";
import { deleteArticle, getArticle, updateArticle } from "@/services/article";

export const dynamic = "force-dynamic";

type Context = RouteContext<"/api/admin/articles/[id]">;

export const GET = adminRoute<Context>(async (_request, context) => {
  const id = idSchema.parse((await context.params).id);
  return ok(await getArticle(id));
});

export const PATCH = adminRoute<Context>(async (request, context, admin) => {
  const id = idSchema.parse((await context.params).id);
  const input = articleUpdateSchema.parse(await readJson(request));
  return ok(await updateArticle(id, input, admin.user.id));
});

export const DELETE = adminRoute<Context>(async (_request, context, admin) => {
  const id = idSchema.parse((await context.params).id);
  await deleteArticle(id, admin.user.id);
  return ok({ deleted: true });
});
