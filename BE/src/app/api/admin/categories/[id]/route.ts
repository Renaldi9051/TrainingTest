import { adminRoute } from "@/lib/auth";
import { ok, readJson } from "@/lib/http";
import { categoryUpdateSchema } from "@/lib/validators/category";
import { idSchema } from "@/lib/validators/common";
import { deleteCategory, getCategory, updateCategory } from "@/services/category";

export const dynamic = "force-dynamic";

type Context = RouteContext<"/api/admin/categories/[id]">;

export const GET = adminRoute<Context>(async (_request, context) => {
  const id = idSchema.parse((await context.params).id);
  return ok(await getCategory(id));
});

export const PATCH = adminRoute<Context>(async (request, context, admin) => {
  const id = idSchema.parse((await context.params).id);
  const input = categoryUpdateSchema.parse(await readJson(request));
  return ok(await updateCategory(id, input, admin.user.id));
});

export const DELETE = adminRoute<Context>(async (_request, context, admin) => {
  const id = idSchema.parse((await context.params).id);
  await deleteCategory(id, admin.user.id);
  return ok({ deleted: true });
});
