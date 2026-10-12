import { adminRoute } from "@/lib/auth";
import { ok } from "@/lib/http";
import { idSchema } from "@/lib/validators/common";
import { restoreHomeSection } from "@/services/home-section";

export const dynamic = "force-dynamic";

type Context = RouteContext<"/api/admin/home-sections/[id]/restore">;

export const POST = adminRoute<Context>(async (_request, context, admin) => {
  const id = idSchema.parse((await context.params).id);
  return ok(await restoreHomeSection(id, admin.user.id));
});
