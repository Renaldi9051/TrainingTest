import { adminRoute } from "@/lib/auth";
import { ok, readJson } from "@/lib/http";
import { idSchema } from "@/lib/validators/common";
import { trainingUpdateSchema } from "@/lib/validators/training";
import { deleteTraining, getTraining, updateTraining } from "@/services/training";

export const dynamic = "force-dynamic";

type Context = RouteContext<"/api/admin/trainings/[id]">;

export const GET = adminRoute<Context>(async (_request, context) => {
  const id = idSchema.parse((await context.params).id);
  return ok(await getTraining(id));
});

export const PATCH = adminRoute<Context>(async (request, context, admin) => {
  const id = idSchema.parse((await context.params).id);
  const input = trainingUpdateSchema.parse(await readJson(request));
  return ok(await updateTraining(id, input, admin.user.id));
});

export const DELETE = adminRoute<Context>(async (_request, context, admin) => {
  const id = idSchema.parse((await context.params).id);
  await deleteTraining(id, admin.user.id);
  return ok({ deleted: true });
});
