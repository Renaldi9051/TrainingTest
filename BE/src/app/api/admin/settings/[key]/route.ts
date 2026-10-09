import { adminRoute } from "@/lib/auth";
import { ok, readJson } from "@/lib/http";
import { settingKeySchema } from "@/lib/validators/settings";
import { updateSetting } from "@/services/settings";

export const dynamic = "force-dynamic";

type Context = RouteContext<"/api/admin/settings/[key]">;

export const PUT = adminRoute<Context>(async (request, context, admin) => {
  const key = settingKeySchema.parse((await context.params).key);
  return ok(await updateSetting(key, await readJson(request), admin.user.id));
});
