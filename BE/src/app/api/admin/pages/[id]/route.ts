import { adminRoute } from "@/lib/auth";
import { ok, readJson } from "@/lib/http";
import { idSchema } from "@/lib/validators/common";
import { pageUpdateSchema } from "@/lib/validators/page";
import { deletePage, getPage, updatePage } from "@/services/page";

export const dynamic = "force-dynamic";

type Context = RouteContext<"/api/admin/pages/[id]">;

export const GET = adminRoute<Context>(async (_request, context) => {
  const id = idSchema.parse((await context.params).id);
  return ok(await getPage(id));
});

export const PATCH = adminRoute<Context>(async (request, context, admin) => {
  const id = idSchema.parse((await context.params).id);
  const input = pageUpdateSchema.parse(await readJson(request));
  return ok(await updatePage(id, input, admin.user.id));
});

export const DELETE = adminRoute<Context>(async (_request, context, admin) => {
  const id = idSchema.parse((await context.params).id);
  await deletePage(id, admin.user.id);
  return ok({ deleted: true });
});
