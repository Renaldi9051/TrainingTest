import { requestMeta } from "@/lib/auth";
import { getEnv } from "@/lib/env";
import { ok, readJson, route } from "@/lib/http";
import { assertAllowedOrigin } from "@/lib/request";
import { inquiryCreateSchema } from "@/lib/validators/inquiry";
import { createInquiry } from "@/services/inquiry";

export const dynamic = "force-dynamic";

// Form inquiry publik (detail pelatihan, /kontak). Origin wajib terdaftar (CSRF); honeypot dan
// rate limit di service. Respons tidak membedakan honeypot dari kiriman sungguhan.
export const POST = route(async (request) => {
  assertAllowedOrigin(request, getEnv().ALLOWED_ORIGINS);
  const input = inquiryCreateSchema.parse(await readJson(request));
  const { ip } = requestMeta(request);
  await createInquiry(input, { ip });
  return ok({ received: true }, undefined, 201);
});
