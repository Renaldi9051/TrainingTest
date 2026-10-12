import { permanentRedirect, redirect } from "next/navigation";
import type { PublicRedirect } from "@/lib/api/public";

// Ikuti redirect dari tabel Redirect: PERMANENT -> 308 (permanentRedirect), TEMPORARY -> 307 (redirect).
// Next memakai 308/307 (bukan 301/302) supaya metode request tetap sama; maknanya setara untuk SEO.
export function followRedirect(target: PublicRedirect): never {
  if (target.permanent) permanentRedirect(target.to);
  redirect(target.to);
}
