import { adminRoute } from "@/lib/auth";
import { ok } from "@/lib/http";
import { idSchema } from "@/lib/validators/common";
import { restoreTestimonial } from "@/services/testimonial";

export const dynamic = "force-dynamic";

type Context = RouteContext<"/api/admin/testimonials/[id]/restore">;

export const POST = adminRoute<Context>(async (_request, context, admin) => {
  const id = idSchema.parse((await context.params).id);
  return ok(await restoreTestimonial(id, admin.user.id));
});
