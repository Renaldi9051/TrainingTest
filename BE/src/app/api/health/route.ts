import { fail, ok } from "@/lib/http";
import { isDatabaseUp } from "@/services/health";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isDatabaseUp())) {
    return fail(503, "DB_UNAVAILABLE", "Database tidak dapat dihubungi.");
  }
  return ok({ status: "ok", db: "ok" });
}
