import { ok, route } from "@/lib/http";
import { listPublicClients } from "@/services/client";

export const dynamic = "force-dynamic";

export const GET = route(async () => ok(await listPublicClients()));
