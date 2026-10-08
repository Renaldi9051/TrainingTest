import { adminRoute } from "@/lib/auth";
import { ok } from "@/lib/http";
import { getDashboardStats } from "@/services/dashboard";

export const dynamic = "force-dynamic";

export const GET = adminRoute(async () => ok(await getDashboardStats()));
