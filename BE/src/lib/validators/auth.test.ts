import { describe, expect, it } from "vitest";
import { loginSchema } from "@/lib/validators/auth";

describe("loginSchema", () => {
  it("menormalkan email (trim + huruf kecil)", () => {
    expect(loginSchema.parse({ email: "  Admin@Example.COM ", password: "x" }).email).toBe(
      "admin@example.com",
    );
  });

  it("menolak email tidak valid dan password kosong dengan pesan Bahasa Indonesia", () => {
    const result = loginSchema.safeParse({ email: "bukan", password: "" });
    expect(result.success).toBe(false);
    const messages = result.error?.issues.map((issue) => issue.message);
    expect(messages).toContain("Format email tidak valid.");
    expect(messages).toContain("Kata sandi wajib diisi.");
  });
});
