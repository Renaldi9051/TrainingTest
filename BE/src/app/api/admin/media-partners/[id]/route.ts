import { adminRoute } from "@/lib/auth";
import { ok, readJson } from "@/lib/http";
import { idSchema } from "@/lib/validators/common";
import { mediaPartnerUpdateSchema } from "@/lib/validators/media-partner";
import { deleteMediaPartner, getMediaPartner, updateMediaPartner } from "@/services/media-partner";

export const dynamic = "force-dynamic";

type Context = RouteContext<"/api/admin/media-partners/[id]">;

export const GET = adminRoute<Context>(async (_request, context) => {
  const id = idSchema.parse((await context.params).id);
  return ok(await getMediaPartner(id));
});

export const PATCH = adminRoute<Context>(async (request, context, admin) => {
  const id = idSchema.parse((await context.params).id);
  const input = mediaPartnerUpdateSchema.parse(await readJson(request));
  return ok(await updateMediaPartner(id, input, admin.user.id));
});

export const DELETE = adminRoute<Context>(async (_request, context, admin) => {
  const id = idSchema.parse((await context.params).id);
  await deleteMediaPartner(id, admin.user.id);
  return ok({ deleted: true });
});
