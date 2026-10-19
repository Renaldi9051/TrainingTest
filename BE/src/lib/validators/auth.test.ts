import { describe, expect, it } from "vitest";
import { loginSchema } from "@/lib/validators/auth";

describe("loginSchema", () => {
  it("hanya menerima kata sandi; field lain (mis. email lama) diabaikan", () => {
    expect(loginSchema.parse({ email: "admin@example.com", password: "x" })).toEqual({ password: "x" });
  });

  it("menolak password kosong dan terlalu panjang dengan pesan Bahasa Indonesia", () => {
    const messages = (input: unknown) => loginSchema.safeParse(input).error?.issues.map((issue) => issue.message);
    expect(messages({ password: "" })).toContain("Kata sandi wajib diisi.");
    expect(messages({})).toContain("Kata sandi wajib diisi.");
    expect(messages({ password: "x".repeat(257) })).toContain("Kata sandi terlalu panjang.");
  });
});
