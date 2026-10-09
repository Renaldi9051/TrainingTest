import { adminRoute } from "@/lib/auth";
import { ok, readJson } from "@/lib/http";
import { idSchema } from "@/lib/validators/common";
import { navUpdateSchema } from "@/lib/validators/nav";
import { deleteNavItem, updateNavItem } from "@/services/nav";

export const dynamic = "force-dynamic";

type Context = RouteContext<"/api/admin/nav/[id]">;

export const PATCH = adminRoute<Context>(async (request, context, admin) => {
  const id = idSchema.parse((await context.params).id);
  const input = navUpdateSchema.parse(await readJson(request));
  return ok(await updateNavItem(id, input, admin.user.id));
});

export const DELETE = adminRoute<Context>(async (_request, context, admin) => {
  const id = idSchema.parse((await context.params).id);
  await deleteNavItem(id, admin.user.id);
  return ok({ deleted: true });
});
