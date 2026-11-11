import { HttpError, ok, route } from "@/lib/http";
import { slugSchema } from "@/lib/slug";
import { publicCategoryTrainingsQuerySchema } from "@/lib/validators/category";
import { listPublicCategoryTrainings } from "@/services/category";

export const dynamic = "force-dynamic";

type Context = RouteContext<"/api/public/categories/[slug]/trainings">;

// Daftar judul pelatihan landing kategori per halaman (?hal=) + cari judul (?q=).
export const GET = route<Context>(async (request, context) => {
  const parsed = slugSchema.safeParse((await context.params).slug);
  const query = publicCategoryTrainingsQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
  const list = parsed.success ? await listPublicCategoryTrainings(parsed.data, query) : null;
  if (!list) throw new HttpError(404, "NOT_FOUND", "Kategori tidak ditemukan.");
  return ok(list.items, list.meta);
});
