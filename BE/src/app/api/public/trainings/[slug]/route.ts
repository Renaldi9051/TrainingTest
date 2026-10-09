import { HttpError, ok, route } from "@/lib/http";
import { slugSchema } from "@/lib/slug";
import { getPublicTraining } from "@/services/training-public";

export const dynamic = "force-dynamic";

type Context = RouteContext<"/api/public/trainings/[slug]">;

export const GET = route<Context>(async (_request, context) => {
  const parsed = slugSchema.safeParse((await context.params).slug);
  const training = parsed.success ? await getPublicTraining(parsed.data) : null;
  if (!training) throw new HttpError(404, "NOT_FOUND", "Pelatihan tidak ditemukan.");
  return ok(training);
});
