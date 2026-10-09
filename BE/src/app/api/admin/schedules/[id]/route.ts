import { adminRoute } from "@/lib/auth";
import { ok, readJson } from "@/lib/http";
import { idSchema } from "@/lib/validators/common";
import { scheduleUpdateSchema } from "@/lib/validators/schedule";
import { deleteSchedule, getSchedule, updateSchedule } from "@/services/schedule";

export const dynamic = "force-dynamic";

type Context = RouteContext<"/api/admin/schedules/[id]">;

export const GET = adminRoute<Context>(async (_request, context) => {
  const id = idSchema.parse((await context.params).id);
  return ok(await getSchedule(id));
});

export const PATCH = adminRoute<Context>(async (request, context, admin) => {
  const id = idSchema.parse((await context.params).id);
  const input = scheduleUpdateSchema.parse(await readJson(request));
  return ok(await updateSchedule(id, input, admin.user.id));
});

export const DELETE = adminRoute<Context>(async (_request, context, admin) => {
  const id = idSchema.parse((await context.params).id);
  await deleteSchedule(id, admin.user.id);
  return ok({ deleted: true });
});
