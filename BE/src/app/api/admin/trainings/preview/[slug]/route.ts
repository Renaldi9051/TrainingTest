import { adminRoute } from "@/lib/auth";
import { HttpError, ok } from "@/lib/http";
import { slugSchema } from "@/lib/slug";
import { getTrainingPreview } from "@/services/training-public";

export const dynamic = "force-dynamic";

type Context = RouteContext<"/api/admin/trainings/preview/[slug]">;

// Pratinjau draft untuk FE (draft mode): bentuk sama dengan detail publik, termasuk draft/terjadwal.
export const GET = adminRoute<Context>(async (_request, context) => {
  const parsed = slugSchema.safeParse((await context.params).slug);
  const training = parsed.success ? await getTrainingPreview(parsed.data) : null;
  if (!training) throw new HttpError(404, "NOT_FOUND", "Pelatihan tidak ditemukan.");
  return ok(training);
});
