import { adminRoute } from "@/lib/auth";
import { ok, readJson } from "@/lib/http";
import { idSchema } from "@/lib/validators/common";
import { clientUpdateSchema } from "@/lib/validators/client";
import { deleteClient, getClient, updateClient } from "@/services/client";

export const dynamic = "force-dynamic";

type Context = RouteContext<"/api/admin/clients/[id]">;

export const GET = adminRoute<Context>(async (_request, context) => {
  const id = idSchema.parse((await context.params).id);
  return ok(await getClient(id));
});

export const PATCH = adminRoute<Context>(async (request, context, admin) => {
  const id = idSchema.parse((await context.params).id);
  const input = clientUpdateSchema.parse(await readJson(request));
  return ok(await updateClient(id, input, admin.user.id));
});

export const DELETE = adminRoute<Context>(async (_request, context, admin) => {
  const id = idSchema.parse((await context.params).id);
  await deleteClient(id, admin.user.id);
  return ok({ deleted: true });
});
