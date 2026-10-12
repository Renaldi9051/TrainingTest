import { adminRoute } from "@/lib/auth";
import { ok, readJson } from "@/lib/http";
import { parseSearchParams } from "@/lib/list-query";
import { mediaPartnerCreateSchema, mediaPartnerListQuerySchema } from "@/lib/validators/media-partner";
import { createMediaPartner, listMediaPartners } from "@/services/media-partner";

export const dynamic = "force-dynamic";

export const GET = adminRoute(async (request) => {
  const query = parseSearchParams(mediaPartnerListQuerySchema, request.nextUrl.searchParams);
  const { items, meta } = await listMediaPartners(query);
  return ok(items, meta);
});

export const POST = adminRoute(async (request, _context, admin) => {
  const input = mediaPartnerCreateSchema.parse(await readJson(request));
  return ok(await createMediaPartner(input, admin.user.id), undefined, 201);
});
