import { adminRoute } from "@/lib/auth";
import { ok, readOptionalJson } from "@/lib/http";
import { idSchema, restoreSchema } from "@/lib/validators/common";
import { restoreTraining } from "@/services/training";

export const dynamic = "force-dynamic";

type Context = RouteContext<"/api/admin/trainings/[id]/restore">;

export const POST = adminRoute<Context>(async (request, context, admin) => {
  const id = idSchema.parse((await context.params).id);
  const input = restoreSchema.parse(await readOptionalJson(request));
  return ok(await restoreTraining(id, input, admin.user.id));
});
