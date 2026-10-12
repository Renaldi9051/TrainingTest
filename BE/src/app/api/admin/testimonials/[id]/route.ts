import { adminRoute } from "@/lib/auth";
import { ok, readJson } from "@/lib/http";
import { idSchema } from "@/lib/validators/common";
import { testimonialUpdateSchema } from "@/lib/validators/testimonial";
import { deleteTestimonial, getTestimonial, updateTestimonial } from "@/services/testimonial";

export const dynamic = "force-dynamic";

type Context = RouteContext<"/api/admin/testimonials/[id]">;

export const GET = adminRoute<Context>(async (_request, context) => {
  const id = idSchema.parse((await context.params).id);
  return ok(await getTestimonial(id));
});

export const PATCH = adminRoute<Context>(async (request, context, admin) => {
  const id = idSchema.parse((await context.params).id);
  const input = testimonialUpdateSchema.parse(await readJson(request));
  return ok(await updateTestimonial(id, input, admin.user.id));
});

export const DELETE = adminRoute<Context>(async (_request, context, admin) => {
  const id = idSchema.parse((await context.params).id);
  await deleteTestimonial(id, admin.user.id);
  return ok({ deleted: true });
});
