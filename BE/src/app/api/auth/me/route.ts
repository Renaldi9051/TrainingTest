import { adminRoute } from "@/lib/auth";
import { ok } from "@/lib/http";

export const dynamic = "force-dynamic";

export const GET = adminRoute(async (_request, _context, admin) => ok({ user: admin.user }));
