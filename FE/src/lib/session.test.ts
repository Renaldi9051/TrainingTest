import { describe, expect, it } from "vitest";
import { safeAdminPath } from "@/lib/session";

describe("safeAdminPath", () => {
  it.each([
    ["/admin/media", "/admin/media"],
    ["/admin/media?page=2", "/admin/media?page=2"],
    ["/admin", "/admin"],
  ])("menerima path admin %s", (input, expected) => {
    expect(safeAdminPath(input)).toBe(expected);
  });

  it.each([
    [null],
    [undefined],
    [""],
    ["https://jahat.example/admin"],
    ["//jahat.example/admin"],
    ["/profil"],
    ["/admin/login"],
    ["/admin/login?next=/admin"],
    ["/admin\\..\\x"],
  ])("menolak %s dan kembali ke /admin", (input) => {
    expect(safeAdminPath(input)).toBe("/admin");
  });
});
