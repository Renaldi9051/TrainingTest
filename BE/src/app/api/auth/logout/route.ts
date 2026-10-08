import { requestMeta } from "@/lib/auth";
import { getEnv } from "@/lib/env";
import { ok, route } from "@/lib/http";
import { assertAllowedOrigin } from "@/lib/request";
import { clearSessionCookie, SESSION_COOKIE } from "@/lib/session-cookie";
import { logout } from "@/services/auth";

// Selalu sukses (idempoten): cookie dihapus walaupun sesinya sudah tidak ada.
export const POST = route(async (request) => {
  assertAllowedOrigin(request, getEnv().ALLOWED_ORIGINS);
  await logout(request.cookies.get(SESSION_COOKIE)?.value, requestMeta(request));
  const response = ok({ loggedOut: true });
  clearSessionCookie(response);
  return response;
});
