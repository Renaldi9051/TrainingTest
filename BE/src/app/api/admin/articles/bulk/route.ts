import { adminRoute } from "@/lib/auth";
import { ok, readJson } from "@/lib/http";
import { articleBulkSchema } from "@/lib/validators/article";
import { bulkArticles } from "@/services/article";

export const dynamic = "force-dynamic";

export const POST = adminRoute(async (request, _context, admin) => {
  const input = articleBulkSchema.parse(await readJson(request));
  return ok(await bulkArticles(input, admin.user.id));
});
