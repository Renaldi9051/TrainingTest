import { adminRoute } from "@/lib/auth";
import { ok, readJson } from "@/lib/http";
import { trainingBulkSchema } from "@/lib/validators/training";
import { bulkTrainings } from "@/services/training";

export const dynamic = "force-dynamic";

export const POST = adminRoute(async (request, _context, admin) => {
  const input = trainingBulkSchema.parse(await readJson(request));
  return ok(await bulkTrainings(input, admin.user.id));
});
