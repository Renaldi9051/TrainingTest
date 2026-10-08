import { adminRoute } from "@/lib/auth";
import { ok } from "@/lib/http";
import { listMediaFolders } from "@/services/media";

export const dynamic = "force-dynamic";

export const GET = adminRoute(async () => ok(await listMediaFolders()));
