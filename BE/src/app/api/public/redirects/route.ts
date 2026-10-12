import { z } from "zod";
import { HttpError, ok, route } from "@/lib/http";
import { parseSearchParams } from "@/lib/list-query";
import { isInternalPath } from "@/lib/validators/common";
import { findPublicRedirect } from "@/services/redirect";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  path: z.string().trim().max(500).refine(isInternalPath, { error: "Path tidak valid." }),
});

// ?path=/layanan/slug-lama -> { to, permanent }. 404 kalau tidak ada redirect aktif.
export const GET = route(async (request) => {
  const { path } = parseSearchParams(querySchema, request.nextUrl.searchParams);
  const redirect = await findPublicRedirect(path);
  if (!redirect) throw new HttpError(404, "NOT_FOUND", "Redirect tidak ditemukan.");
  return ok(redirect);
});
