import { HttpError, ok, route } from "@/lib/http";
import { slugSchema } from "@/lib/slug";
import { getPublicCategory } from "@/services/category";

export const dynamic = "force-dynamic";

type Context = RouteContext<"/api/public/categories/[slug]">;

export const GET = route<Context>(async (_request, context) => {
  const parsed = slugSchema.safeParse((await context.params).slug);
  const category = parsed.success ? await getPublicCategory(parsed.data) : null;
  if (!category) throw new HttpError(404, "NOT_FOUND", "Kategori tidak ditemukan.");
  return ok(category);
});
