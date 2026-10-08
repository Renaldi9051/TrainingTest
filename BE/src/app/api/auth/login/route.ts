import { requestMeta } from "@/lib/auth";
import { getEnv } from "@/lib/env";
import { ok, readJson, route } from "@/lib/http";
import { assertAllowedOrigin } from "@/lib/request";
import { setSessionCookie } from "@/lib/session-cookie";
import { loginSchema } from "@/lib/validators/auth";
import { login } from "@/services/auth";

export const POST = route(async (request) => {
  assertAllowedOrigin(request, getEnv().ALLOWED_ORIGINS);
  const input = loginSchema.parse(await readJson(request));
  const { user, token, expiresAt } = await login(input, requestMeta(request));
  const response = ok({ user });
  setSessionCookie(response, token, expiresAt);
  return response;
});
