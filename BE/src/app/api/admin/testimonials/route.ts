import { adminRoute } from "@/lib/auth";
import { ok, readJson } from "@/lib/http";
import { parseSearchParams } from "@/lib/list-query";
import { testimonialCreateSchema, testimonialListQuerySchema } from "@/lib/validators/testimonial";
import { createTestimonial, listTestimonials } from "@/services/testimonial";

export const dynamic = "force-dynamic";

export const GET = adminRoute(async (request) => {
  const query = parseSearchParams(testimonialListQuerySchema, request.nextUrl.searchParams);
  const { items, meta } = await listTestimonials(query);
  return ok(items, meta);
});

export const POST = adminRoute(async (request, _context, admin) => {
  const input = testimonialCreateSchema.parse(await readJson(request));
  return ok(await createTestimonial(input, admin.user.id), undefined, 201);
});
