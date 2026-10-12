import { adminRoute } from "@/lib/auth";
import { ok, readOptionalJson } from "@/lib/http";
import { idSchema, restoreSchema } from "@/lib/validators/common";
import { restorePage } from "@/services/page";

export const dynamic = "force-dynamic";

type Context = RouteContext<"/api/admin/pages/[id]/restore">;

export const POST = adminRoute<Context>(async (request, context, admin) => {
  const id = idSchema.parse((await context.params).id);
  const input = restoreSchema.parse(await readOptionalJson(request));
  return ok(await restorePage(id, input, admin.user.id));
});
