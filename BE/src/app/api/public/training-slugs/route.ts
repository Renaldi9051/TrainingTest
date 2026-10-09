import { z } from "zod";
import { ok, route } from "@/lib/http";
import { listPublicTrainingSlugs } from "@/services/training-public";

export const dynamic = "force-dynamic";

const querySchema = z.object({ limit: z.coerce.number().int().min(1).max(200).default(50).catch(50) });

// Slug pelatihan tayang terbaru, untuk generateStaticParams di FE.
export const GET = route(async (request) => {
  const { limit } = querySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
  return ok(await listPublicTrainingSlugs(limit));
});
