import { ok, route } from "@/lib/http";
import { listPublicArticleCategories } from "@/services/article-public";

export const dynamic = "force-dynamic";

// Kategori yang punya artikel tayang (chip filter /artikel).
export const GET = route(async () => ok(await listPublicArticleCategories()));
