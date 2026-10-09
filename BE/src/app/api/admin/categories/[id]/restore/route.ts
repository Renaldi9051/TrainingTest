import { adminRoute } from "@/lib/auth";
import { ok, readOptionalJson } from "@/lib/http";
import { idSchema, restoreSchema } from "@/lib/validators/common";
import { restoreCategory } from "@/services/category";

export const dynamic = "force-dynamic";

type Context = RouteContext<"/api/admin/categories/[id]/restore">;

export const POST = adminRoute<Context>(async (request, context, admin) => {
  const id = idSchema.parse((await context.params).id);
  const input = restoreSchema.parse(await readOptionalJson(request));
  return ok(await restoreCategory(id, input, admin.user.id));
});
