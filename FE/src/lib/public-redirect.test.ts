import { getRedirectStatusCodeFromError, getURLFromRedirectError } from "next/dist/client/components/redirect";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { describe, expect, it } from "vitest";
import { followRedirect } from "./public-redirect";

function thrownBy(fn: () => void) {
  try {
    fn();
  } catch (error) {
    if (isRedirectError(error)) return { status: getRedirectStatusCodeFromError(error), url: getURLFromRedirectError(error) };
    throw error;
  }
  throw new Error("tidak redirect");
}

describe("followRedirect", () => {
  it("redirect permanen (301 di tabel) -> 308", () => {
    expect(thrownBy(() => followRedirect({ to: "/layanan/baru", permanent: true }))).toEqual({ status: 308, url: "/layanan/baru" });
  });

  it("redirect sementara (302 di tabel) -> 307", () => {
    expect(thrownBy(() => followRedirect({ to: "/promo", permanent: false }))).toEqual({ status: 307, url: "/promo" });
  });
});
