import { adminRoute } from "@/lib/auth";
import { ok, readJson } from "@/lib/http";
import { mediaIdSchema, mediaUpdateSchema } from "@/lib/validators/media";
import { deleteMedia, getMedia, getMediaUsages, updateMedia } from "@/services/media";

export const dynamic = "force-dynamic";

type Context = RouteContext<"/api/admin/media/[id]">;

export const GET = adminRoute<Context>(async (_request, context) => {
  const id = mediaIdSchema.parse((await context.params).id);
  const [media, usages] = await Promise.all([getMedia(id), getMediaUsages(id)]);
  return ok({ ...media, usages });
});

export const PATCH = adminRoute<Context>(async (request, context, admin) => {
  const id = mediaIdSchema.parse((await context.params).id);
  const input = mediaUpdateSchema.parse(await readJson(request));
  return ok(await updateMedia(id, input, admin.user.id));
});

export const DELETE = adminRoute<Context>(async (_request, context, admin) => {
  const id = mediaIdSchema.parse((await context.params).id);
  await deleteMedia(id, admin.user.id);
  return ok({ deleted: true });
});
