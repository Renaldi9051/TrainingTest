import { HttpError, ok, route } from "@/lib/http";
import { slugSchema } from "@/lib/slug";
import { getPublicService } from "@/services/service";

export const dynamic = "force-dynamic";

type Context = RouteContext<"/api/public/services/[slug]">;

export const GET = route<Context>(async (_request, context) => {
  const parsed = slugSchema.safeParse((await context.params).slug);
  const service = parsed.success ? await getPublicService(parsed.data) : null;
  if (!service) throw new HttpError(404, "NOT_FOUND", "Layanan tidak ditemukan.");
  return ok(service);
});
