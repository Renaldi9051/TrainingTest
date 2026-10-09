import { adminRoute } from "@/lib/auth";
import { ok, readJson } from "@/lib/http";
import { parseSearchParams } from "@/lib/list-query";
import { trainingCreateSchema, trainingListQuerySchema } from "@/lib/validators/training";
import { createTraining, listTrainings } from "@/services/training";

export const dynamic = "force-dynamic";

export const GET = adminRoute(async (request) => {
  const query = parseSearchParams(trainingListQuerySchema, request.nextUrl.searchParams);
  const { items, meta } = await listTrainings(query);
  return ok(items, meta);
});

export const POST = adminRoute(async (request, _context, admin) => {
  const input = trainingCreateSchema.parse(await readJson(request));
  return ok(await createTraining(input, admin.user.id), undefined, 201);
});
