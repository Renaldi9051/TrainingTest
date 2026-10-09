import { adminRoute } from "@/lib/auth";
import { ok } from "@/lib/http";
import { listCategoryOptions } from "@/services/category";

export const dynamic = "force-dynamic";

export const GET = adminRoute(async () => ok(await listCategoryOptions()));
