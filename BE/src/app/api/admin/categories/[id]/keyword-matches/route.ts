import { adminRoute } from "@/lib/auth";
import { ok, readJson } from "@/lib/http";
import { keywordLinkSchema } from "@/lib/validators/category";
import { idSchema } from "@/lib/validators/common";
import { linkKeywordMatches, listKeywordMatches } from "@/services/category-keywords";

export const dynamic = "force-dynamic";

type Context = RouteContext<"/api/admin/categories/[id]/keyword-matches">;

// Pelatihan yang judulnya cocok dengan kata kunci kategori tapi belum tertaut.
export const GET = adminRoute<Context>(async (_request, context) => {
  const id = idSchema.parse((await context.params).id);
  return ok(await listKeywordMatches(id));
});

// Tautkan pelatihan terpilih (hanya menambah tautan).
export const POST = adminRoute<Context>(async (request, context, admin) => {
  const id = idSchema.parse((await context.params).id);
  const input = keywordLinkSchema.parse(await readJson(request));
  return ok(await linkKeywordMatches(id, input, admin.user.id));
});
