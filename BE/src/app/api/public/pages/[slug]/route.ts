import { HttpError, ok, route } from "@/lib/http";
import { slugSchema } from "@/lib/slug";
import { getPublicPage } from "@/services/page";

export const dynamic = "force-dynamic";

type Context = RouteContext<"/api/public/pages/[slug]">;

export const GET = route<Context>(async (_request, context) => {
  const parsed = slugSchema.safeParse((await context.params).slug);
  const page = parsed.success ? await getPublicPage(parsed.data) : null;
  if (!page) throw new HttpError(404, "NOT_FOUND", "Halaman tidak ditemukan.");
  return ok(page);
});
