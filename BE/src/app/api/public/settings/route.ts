import { ok, route } from "@/lib/http";
import { getPublicSettings } from "@/services/settings";

export const dynamic = "force-dynamic";

export const GET = route(async () => ok(await getPublicSettings()));
