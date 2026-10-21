import { adminRoute } from "@/lib/auth";
import { ok, readJson } from "@/lib/http";
import { categoryMergeSchema } from "@/lib/validators/category";
import { idSchema } from "@/lib/validators/common";
import { mergeCategory } from "@/services/category-merge";

export const dynamic = "force-dynamic";

type Context = RouteContext<"/api/admin/categories/[id]/merge">;

// Gabungkan kategori ini ke kategori tujuan; kategori ini masuk Sampah.
export const POST = adminRoute<Context>(async (request, context, admin) => {
  const id = idSchema.parse((await context.params).id);
  const input = categoryMergeSchema.parse(await readJson(request));
  return ok(await mergeCategory(id, input, admin.user.id));
});
