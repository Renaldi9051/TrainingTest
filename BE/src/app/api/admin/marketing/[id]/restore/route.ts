import { adminRoute } from "@/lib/auth";
import { ok } from "@/lib/http";
import { idSchema } from "@/lib/validators/common";
import { restoreMarketing } from "@/services/marketing";

export const dynamic = "force-dynamic";

type Context = RouteContext<"/api/admin/marketing/[id]/restore">;

export const POST = adminRoute<Context>(async (_request, context, admin) => {
  const id = idSchema.parse((await context.params).id);
  return ok(await restoreMarketing(id, admin.user.id));
});
