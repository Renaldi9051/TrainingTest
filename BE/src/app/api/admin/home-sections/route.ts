import { adminRoute } from "@/lib/auth";
import { ok, readJson } from "@/lib/http";
import { homeSectionCreateSchema } from "@/lib/validators/home-section";
import { createHomeSection, listHomeSections } from "@/services/home-section";

export const dynamic = "force-dynamic";

// Semua section aktif sesuai urutan (jumlahnya kecil, tanpa paginasi).
export const GET = adminRoute(async () => ok(await listHomeSections()));

export const POST = adminRoute(async (request, _context, admin) => {
  const input = homeSectionCreateSchema.parse(await readJson(request));
  return ok(await createHomeSection(input, admin.user.id), undefined, 201);
});
