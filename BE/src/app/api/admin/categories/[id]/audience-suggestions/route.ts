import { adminRoute } from "@/lib/auth";
import { ok } from "@/lib/http";
import { idSchema } from "@/lib/validators/common";
import { getAudienceSuggestions } from "@/services/category-audience";

export const dynamic = "force-dynamic";

type Context = RouteContext<"/api/admin/categories/[id]/audience-suggestions">;

// Saran target peserta yang dirangkum dari pelatihan tayang di kategori ini (read-only). Admin
// memilih mana yang dipakai lalu menyimpannya lewat PATCH kategori biasa (audienceSource = "auto").
export const GET = adminRoute<Context>(async (_request, context) => {
  const id = idSchema.parse((await context.params).id);
  return ok(await getAudienceSuggestions(id));
});
