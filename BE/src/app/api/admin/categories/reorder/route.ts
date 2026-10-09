import { adminRoute } from "@/lib/auth";
import { ok, readJson } from "@/lib/http";
import { reorderSchema } from "@/lib/validators/common";
import { reorderCategories } from "@/services/category";

export const dynamic = "force-dynamic";

export const POST = adminRoute(async (request, _context, admin) => {
  await reorderCategories(reorderSchema.parse(await readJson(request)), admin.user.id);
  return ok({ reordered: true });
});
