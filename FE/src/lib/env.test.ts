import { afterEach, describe, expect, it, vi } from "vitest";
import { parseEnv } from "@/lib/env";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("env FE", () => {
  it("menolak env server yang tidak lengkap", () => {
    expect(() => parseEnv({ BE_INTERNAL_URL: "http://localhost:4000" })).toThrow(/Env FE tidak valid/);
  });

  it("getPublicEnv hanya butuh BE_INTERNAL_URL & NEXT_PUBLIC_SITE_URL (dipakai saat prerender build)", async () => {
    vi.stubEnv("BE_INTERNAL_URL", "http://be:4000");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://contoh.id");
    vi.stubEnv("REVALIDATE_SECRET", undefined);
    const { getPublicEnv } = await import("@/lib/env");
    expect(getPublicEnv()).toEqual({ BE_INTERNAL_URL: "http://be:4000", NEXT_PUBLIC_SITE_URL: "https://contoh.id" });
  });
});
