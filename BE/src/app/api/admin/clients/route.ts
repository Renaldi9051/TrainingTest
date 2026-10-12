import { adminRoute } from "@/lib/auth";
import { ok, readJson } from "@/lib/http";
import { parseSearchParams } from "@/lib/list-query";
import { clientCreateSchema, clientListQuerySchema } from "@/lib/validators/client";
import { createClient, listClients } from "@/services/client";

export const dynamic = "force-dynamic";

export const GET = adminRoute(async (request) => {
  const query = parseSearchParams(clientListQuerySchema, request.nextUrl.searchParams);
  const { items, meta } = await listClients(query);
  return ok(items, meta);
});

export const POST = adminRoute(async (request, _context, admin) => {
  const input = clientCreateSchema.parse(await readJson(request));
  return ok(await createClient(input, admin.user.id), undefined, 201);
});
