import { adminRoute } from "@/lib/auth";
import { HttpError, ok } from "@/lib/http";
import { slugSchema } from "@/lib/slug";
import { getPagePreview } from "@/services/page";

export const dynamic = "force-dynamic";

type Context = RouteContext<"/api/admin/pages/preview/[slug]">;

// Pratinjau draft untuk FE (draft mode): bentuk sama dengan halaman publik, termasuk draft.
export const GET = adminRoute<Context>(async (_request, context) => {
  const parsed = slugSchema.safeParse((await context.params).slug);
  const page = parsed.success ? await getPagePreview(parsed.data) : null;
  if (!page) throw new HttpError(404, "NOT_FOUND", "Halaman tidak ditemukan.");
  return ok(page);
});
