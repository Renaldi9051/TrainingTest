import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/password";

describe("password", () => {
  it("meng-hash dengan argon2id dan bisa diverifikasi", async () => {
    const hash = await hashPassword("rahasia-yang-panjang");
    expect(hash.startsWith("$argon2id$")).toBe(true);
    expect(hash).not.toContain("rahasia-yang-panjang");
    expect(await verifyPassword(hash, "rahasia-yang-panjang")).toBe(true);
  });

  it("menolak password salah", async () => {
    const hash = await hashPassword("rahasia-yang-panjang");
    expect(await verifyPassword(hash, "rahasia-yang-salah")).toBe(false);
  });

  it("menghasilkan hash berbeda untuk password yang sama (salt acak)", async () => {
    expect(await hashPassword("sama-saja-123")).not.toBe(await hashPassword("sama-saja-123"));
  });

  it("mengembalikan false untuk hash rusak, bukan melempar error", async () => {
    expect(await verifyPassword("bukan-hash", "apa-saja")).toBe(false);
  });
});
