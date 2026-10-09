import { adminRoute } from "@/lib/auth";
import { ok, readJson } from "@/lib/http";
import { parseSearchParams } from "@/lib/list-query";
import { categoryCreateSchema, categoryListQuerySchema } from "@/lib/validators/category";
import { createCategory, listCategories } from "@/services/category";

export const dynamic = "force-dynamic";

export const GET = adminRoute(async (request) => {
  const query = parseSearchParams(categoryListQuerySchema, request.nextUrl.searchParams);
  const { items, meta } = await listCategories(query);
  return ok(items, meta);
});

export const POST = adminRoute(async (request, _context, admin) => {
  const input = categoryCreateSchema.parse(await readJson(request));
  return ok(await createCategory(input, admin.user.id), undefined, 201);
});
