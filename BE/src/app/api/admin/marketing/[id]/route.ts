import { adminRoute } from "@/lib/auth";
import { ok, readJson } from "@/lib/http";
import { idSchema } from "@/lib/validators/common";
import { marketingUpdateSchema } from "@/lib/validators/marketing";
import { deleteMarketing, getMarketing, updateMarketing } from "@/services/marketing";

export const dynamic = "force-dynamic";

type Context = RouteContext<"/api/admin/marketing/[id]">;

export const GET = adminRoute<Context>(async (_request, context) => {
  const id = idSchema.parse((await context.params).id);
  return ok(await getMarketing(id));
});

export const PATCH = adminRoute<Context>(async (request, context, admin) => {
  const id = idSchema.parse((await context.params).id);
  const input = marketingUpdateSchema.parse(await readJson(request));
  return ok(await updateMarketing(id, input, admin.user.id));
});

export const DELETE = adminRoute<Context>(async (_request, context, admin) => {
  const id = idSchema.parse((await context.params).id);
  await deleteMarketing(id, admin.user.id);
  return ok({ deleted: true });
});
