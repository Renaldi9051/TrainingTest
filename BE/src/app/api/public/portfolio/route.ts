import { ok, route } from "@/lib/http";
import { listPublicPortfolio } from "@/services/portfolio";

export const dynamic = "force-dynamic";

export const GET = route(async () => ok(await listPublicPortfolio()));
