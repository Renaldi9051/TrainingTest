import { adminRoute } from "@/lib/auth";
import { ok, readJson } from "@/lib/http";
import { idSchema } from "@/lib/validators/common";
import { inquiryUpdateSchema } from "@/lib/validators/inquiry";
import { deleteInquiry, getInquiry, updateInquiry } from "@/services/inquiry";

export const dynamic = "force-dynamic";

type Context = RouteContext<"/api/admin/inquiries/[id]">;

export const GET = adminRoute<Context>(async (_request, context) => {
  const id = idSchema.parse((await context.params).id);
  return ok(await getInquiry(id));
});

export const PATCH = adminRoute<Context>(async (request, context, admin) => {
  const id = idSchema.parse((await context.params).id);
  const input = inquiryUpdateSchema.parse(await readJson(request));
  return ok(await updateInquiry(id, input, admin.user.id));
});

export const DELETE = adminRoute<Context>(async (_request, context, admin) => {
  const id = idSchema.parse((await context.params).id);
  await deleteInquiry(id, admin.user.id);
  return ok({ deleted: true });
});
