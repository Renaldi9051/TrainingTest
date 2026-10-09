import { adminRoute } from "@/lib/auth";
import { ok, readJson } from "@/lib/http";
import { parseSearchParams } from "@/lib/list-query";
import { scheduleCreateSchema, scheduleListQuerySchema } from "@/lib/validators/schedule";
import { createSchedule, listSchedules } from "@/services/schedule";

export const dynamic = "force-dynamic";

export const GET = adminRoute(async (request) => {
  const query = parseSearchParams(scheduleListQuerySchema, request.nextUrl.searchParams);
  const { items, meta } = await listSchedules(query);
  return ok(items, meta);
});

export const POST = adminRoute(async (request, _context, admin) => {
  const input = scheduleCreateSchema.parse(await readJson(request));
  return ok(await createSchedule(input, admin.user.id), undefined, 201);
});
