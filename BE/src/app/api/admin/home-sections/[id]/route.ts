import { adminRoute } from "@/lib/auth";
import { ok, readJson } from "@/lib/http";
import { idSchema } from "@/lib/validators/common";
import { homeSectionUpdateSchema } from "@/lib/validators/home-section";
import { deleteHomeSection, getHomeSection, updateHomeSection } from "@/services/home-section";

export const dynamic = "force-dynamic";

type Context = RouteContext<"/api/admin/home-sections/[id]">;

export const GET = adminRoute<Context>(async (_request, context) => {
  const id = idSchema.parse((await context.params).id);
  return ok(await getHomeSection(id));
});

export const PATCH = adminRoute<Context>(async (request, context, admin) => {
  const id = idSchema.parse((await context.params).id);
  const input = homeSectionUpdateSchema.parse(await readJson(request));
  return ok(await updateHomeSection(id, input, admin.user.id));
});

export const DELETE = adminRoute<Context>(async (_request, context, admin) => {
  const id = idSchema.parse((await context.params).id);
  await deleteHomeSection(id, admin.user.id);
  return ok({ deleted: true });
});
