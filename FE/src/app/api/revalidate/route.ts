import { timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { getEnv } from "@/lib/env";

// Dipanggil BE setelah mutasi konten (BE/src/lib/revalidate.ts). Route ini menang atas rewrite
// /api/* ke BE karena route filesystem dicek lebih dulu.
const bodySchema = z.object({
  tags: z.array(z.string().trim().min(1).max(100)).min(1).max(50),
});

function secretMatches(received: string | null): boolean {
  const expected = Buffer.from(getEnv().REVALIDATE_SECRET);
  const actual = Buffer.from(received ?? "");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function error(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status });
}

export async function POST(request: Request) {
  if (!secretMatches(request.headers.get("x-revalidate-secret"))) {
    return error(401, "UNAUTHORIZED", "Secret revalidate tidak valid.");
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return error(422, "VALIDATION_ERROR", "Daftar tag tidak valid.");

  // expire: 0 = langsung kedaluwarsa, supaya perubahan tampil di request berikutnya (PRD: < 5 detik).
  for (const tag of parsed.data.tags) revalidateTag(tag, { expire: 0 });
  return Response.json({ data: { revalidated: parsed.data.tags } });
}
