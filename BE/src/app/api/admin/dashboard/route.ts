import { adminRoute } from "@/lib/auth";
import { ok } from "@/lib/http";
import { getDashboard } from "@/services/dashboard";

export const dynamic = "force-dynamic";

export const GET = adminRoute(async () => ok(await getDashboard()));
