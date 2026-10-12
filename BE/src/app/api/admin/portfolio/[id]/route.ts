import { adminRoute } from "@/lib/auth";
import { ok, readJson } from "@/lib/http";
import { idSchema } from "@/lib/validators/common";
import { portfolioUpdateSchema } from "@/lib/validators/portfolio";
import { deletePortfolio, getPortfolio, updatePortfolio } from "@/services/portfolio";

export const dynamic = "force-dynamic";

type Context = RouteContext<"/api/admin/portfolio/[id]">;

export const GET = adminRoute<Context>(async (_request, context) => {
  const id = idSchema.parse((await context.params).id);
  return ok(await getPortfolio(id));
});

export const PATCH = adminRoute<Context>(async (request, context, admin) => {
  const id = idSchema.parse((await context.params).id);
  const input = portfolioUpdateSchema.parse(await readJson(request));
  return ok(await updatePortfolio(id, input, admin.user.id));
});

export const DELETE = adminRoute<Context>(async (_request, context, admin) => {
  const id = idSchema.parse((await context.params).id);
  await deletePortfolio(id, admin.user.id);
  return ok({ deleted: true });
});
