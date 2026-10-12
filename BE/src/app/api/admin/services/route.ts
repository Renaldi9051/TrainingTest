import { adminRoute } from "@/lib/auth";
import { ok, readJson } from "@/lib/http";
import { parseSearchParams } from "@/lib/list-query";
import { serviceCreateSchema, serviceListQuerySchema } from "@/lib/validators/service";
import { createService, listServices } from "@/services/service";

export const dynamic = "force-dynamic";

export const GET = adminRoute(async (request) => {
  const query = parseSearchParams(serviceListQuerySchema, request.nextUrl.searchParams);
  const { items, meta } = await listServices(query);
  return ok(items, meta);
});

export const POST = adminRoute(async (request, _context, admin) => {
  const input = serviceCreateSchema.parse(await readJson(request));
  return ok(await createService(input, admin.user.id), undefined, 201);
});
