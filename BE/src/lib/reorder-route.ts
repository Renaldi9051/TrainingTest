import { adminRoute } from "@/lib/auth";
import { ok, readJson } from "@/lib/http";
import { reorderSchema } from "@/lib/validators/common";
import { reorderResource, type ReorderResource } from "@/services/reorder";

// Handler POST /api/admin/{resource}/reorder untuk semua entitas berurutan.
export function reorderRoute(resource: ReorderResource) {
  return adminRoute(async (request, _context, admin) => {
    await reorderResource(resource, reorderSchema.parse(await readJson(request)), admin.user.id);
    return ok({ reordered: true });
  });
}
