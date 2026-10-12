import { adminRoute } from "@/lib/auth";
import { HttpError, ok } from "@/lib/http";
import { slugSchema } from "@/lib/slug";
import { getServicePreview } from "@/services/service";

export const dynamic = "force-dynamic";

type Context = RouteContext<"/api/admin/services/preview/[slug]">;

// Pratinjau draft untuk FE (draft mode): bentuk sama dengan detail publik, termasuk draft.
export const GET = adminRoute<Context>(async (_request, context) => {
  const parsed = slugSchema.safeParse((await context.params).slug);
  const service = parsed.success ? await getServicePreview(parsed.data) : null;
  if (!service) throw new HttpError(404, "NOT_FOUND", "Layanan tidak ditemukan.");
  return ok(service);
});
