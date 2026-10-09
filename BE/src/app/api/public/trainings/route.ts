import { ok, route } from "@/lib/http";
import { publicTrainingQuerySchema } from "@/lib/validators/training";
import { listPublicTrainings } from "@/services/training-public";

export const dynamic = "force-dynamic";

// ?q=&kategori=a,b&metode=online&tipe=public&urut=terbaru&hal=1
export const GET = route(async (request) => {
  const query = publicTrainingQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
  const { items, meta } = await listPublicTrainings(query);
  return ok(items, meta);
});
