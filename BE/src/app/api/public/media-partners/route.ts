import { ok, route } from "@/lib/http";
import { listPublicMediaPartners } from "@/services/media-partner";

export const dynamic = "force-dynamic";

export const GET = route(async () => ok(await listPublicMediaPartners()));
