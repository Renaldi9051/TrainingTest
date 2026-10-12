import { ok, route } from "@/lib/http";
import { listPublicServices } from "@/services/service";

export const dynamic = "force-dynamic";

export const GET = route(async () => ok(await listPublicServices()));
