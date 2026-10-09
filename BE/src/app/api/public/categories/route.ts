import { ok, route } from "@/lib/http";
import { listPublicCategories } from "@/services/category";

export const dynamic = "force-dynamic";

export const GET = route(async () => ok(await listPublicCategories()));
