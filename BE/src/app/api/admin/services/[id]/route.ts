import { adminRoute } from "@/lib/auth";
import { ok, readJson } from "@/lib/http";
import { idSchema } from "@/lib/validators/common";
import { serviceUpdateSchema } from "@/lib/validators/service";
import { deleteService, getService, updateService } from "@/services/service";

export const dynamic = "force-dynamic";

type Context = RouteContext<"/api/admin/services/[id]">;

export const GET = adminRoute<Context>(async (_request, context) => {
  const id = idSchema.parse((await context.params).id);
  return ok(await getService(id));
});

export const PATCH = adminRoute<Context>(async (request, context, admin) => {
  const id = idSchema.parse((await context.params).id);
  const input = serviceUpdateSchema.parse(await readJson(request));
  return ok(await updateService(id, input, admin.user.id));
});

export const DELETE = adminRoute<Context>(async (_request, context, admin) => {
  const id = idSchema.parse((await context.params).id);
  await deleteService(id, admin.user.id);
  return ok({ deleted: true });
});
