import { afterEach, describe, expect, it, vi } from "vitest";
import { getConfigEnv, isSafeDistDir, parseEnv } from "@/lib/env";

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

describe("NEXT_DIST_DIR", () => {
  it.each([".next/verify", ".next/verify/a", ".next/build-1"])("menerima %s", (value) => {
    expect(isSafeDistDir(value)).toBe(true);
  });

  it.each([
    ".next",
    ".next/",
    ".next/../out",
    ".next/verify/../../x",
    ".next/./verify",
    "/abs/.next/verify",
    "C:/x/.next/verify",
    "verify",
    "./.next/verify",
    ".next/dev",
    ".next/e2e",
    ".next/ve rify",
  ])("menolak %s", (value) => {
    expect(isSafeDistDir(value)).toBe(false);
  });

  it("opsional di getConfigEnv; nilai tidak aman ditolak dengan pesan jelas", () => {
    vi.stubEnv("BE_INTERNAL_URL", "http://localhost:4000");
    vi.stubEnv("NEXT_DIST_DIR", undefined);
    expect(getConfigEnv().NEXT_DIST_DIR).toBeUndefined();
    vi.stubEnv("NEXT_DIST_DIR", ".next/verify");
    expect(getConfigEnv().NEXT_DIST_DIR).toBe(".next/verify");
    vi.stubEnv("NEXT_DIST_DIR", "../out");
    expect(() => getConfigEnv()).toThrow(/NEXT_DIST_DIR/);
  });
});
