import { adminRoute } from "@/lib/auth";
import { ok, readJson } from "@/lib/http";
import { parseSearchParams } from "@/lib/list-query";
import { navCreateSchema, navListQuerySchema } from "@/lib/validators/nav";
import { createNavItem, listNav } from "@/services/nav";

export const dynamic = "force-dynamic";

export const GET = adminRoute(async (request) => {
  const { location } = parseSearchParams(navListQuerySchema, request.nextUrl.searchParams);
  if (location) return ok(await listNav(location));
  const [header, footer] = await Promise.all([listNav("HEADER"), listNav("FOOTER")]);
  return ok({ header, footer });
});

export const POST = adminRoute(async (request, _context, admin) => {
  const input = navCreateSchema.parse(await readJson(request));
  return ok(await createNavItem(input, admin.user.id), undefined, 201);
});
