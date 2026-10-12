import { ok, route } from "@/lib/http";
import { listPublicMarketing } from "@/services/marketing";

export const dynamic = "force-dynamic";

export const GET = route(async () => ok(await listPublicMarketing()));
