import { adminRoute } from "@/lib/auth";
import { ok } from "@/lib/http";
import { idSchema } from "@/lib/validators/common";
import { duplicateTraining } from "@/services/training";

export const dynamic = "force-dynamic";

type Context = RouteContext<"/api/admin/trainings/[id]/duplicate">;

export const POST = adminRoute<Context>(async (_request, context, admin) => {
  const id = idSchema.parse((await context.params).id);
  return ok(await duplicateTraining(id, admin.user.id), undefined, 201);
});
