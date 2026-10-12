import { adminRoute } from "@/lib/auth";
import { ok } from "@/lib/http";
import { idSchema } from "@/lib/validators/common";
import { restoreMediaPartner } from "@/services/media-partner";

export const dynamic = "force-dynamic";

type Context = RouteContext<"/api/admin/media-partners/[id]/restore">;

export const POST = adminRoute<Context>(async (_request, context, admin) => {
  const id = idSchema.parse((await context.params).id);
  return ok(await restoreMediaPartner(id, admin.user.id));
});
