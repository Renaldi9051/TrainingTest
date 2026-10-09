import { ok, route } from "@/lib/http";
import { getPublicNav } from "@/services/nav";

export const dynamic = "force-dynamic";

export const GET = route(async () => ok(await getPublicNav()));
