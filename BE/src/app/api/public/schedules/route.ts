import { ok, route } from "@/lib/http";
import { publicScheduleQuerySchema } from "@/lib/validators/schedule";
import { listPublicSchedules } from "@/services/schedule";

export const dynamic = "force-dynamic";

// ?bulan=2026-11&kota=Jakarta&kategori=keuangan&hal=1
export const GET = route(async (request) => {
  const query = publicScheduleQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
  const { items, meta } = await listPublicSchedules(query);
  return ok(items, meta);
});
