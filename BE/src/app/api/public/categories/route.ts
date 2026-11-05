import { ok, route } from "@/lib/http";
import { publicCategoryGridQuerySchema } from "@/lib/validators/category";
import { listPublicCategories, listPublicCategoryGrid } from "@/services/category";

export const dynamic = "force-dynamic";

// Tanpa parameter: semua kategori publik (filter jadwal, profil). Dengan ?q=, ?huruf=, atau ?page=:
// grid kategori /pelatihan, 24 per halaman, unggulan dulu lalu A-Z, { data, meta }.
export const GET = route(async (request) => {
  const params = request.nextUrl.searchParams;
  if (!params.has("q") && !params.has("huruf") && !params.has("page")) return ok(await listPublicCategories());
  const { items, meta } = await listPublicCategoryGrid(publicCategoryGridQuerySchema.parse(Object.fromEntries(params)));
  return ok(items, meta);
});
