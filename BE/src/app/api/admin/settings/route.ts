import { adminRoute } from "@/lib/auth";
import { ok } from "@/lib/http";
import { getAdminSettings } from "@/services/settings";

export const dynamic = "force-dynamic";

export const GET = adminRoute(async () => ok(await getAdminSettings()));
