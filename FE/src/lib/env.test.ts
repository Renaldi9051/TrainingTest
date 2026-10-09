import { describe, expect, it } from "vitest";
import { parseEnv } from "@/lib/env";

describe("env FE", () => {
  it("menolak env server yang tidak lengkap", () => {
    expect(() => parseEnv({ BE_INTERNAL_URL: "http://localhost:4000" })).toThrow(/Env FE tidak valid/);
  });

  it("getPublicEnv hanya butuh BE_INTERNAL_URL & NEXT_PUBLIC_SITE_URL (dipakai saat prerender build)", async () => {
    const original = { ...process.env };
    process.env.BE_INTERNAL_URL = "http://be:4000";
    process.env.NEXT_PUBLIC_SITE_URL = "https://contoh.id";
    delete process.env.REVALIDATE_SECRET;
    const { getPublicEnv } = await import("@/lib/env");
    expect(getPublicEnv()).toEqual({ BE_INTERNAL_URL: "http://be:4000", NEXT_PUBLIC_SITE_URL: "https://contoh.id" });
    process.env = original;
  });
});
