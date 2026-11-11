import { draftMode } from "next/headers";
import type { NextRequest } from "next/server";
import { localRedirect } from "@/lib/local-redirect";

// Keluar dari mode pratinjau, kembali ke halaman yang sama (hanya path internal).
export async function POST(request: NextRequest) {
  (await draftMode()).disable();
  const form = await request.formData().catch(() => null);
  const back = form?.get("path");
  const path = typeof back === "string" && back.startsWith("/") && !back.startsWith("//") ? back : "/";
  return localRedirect(path, 303);
}
