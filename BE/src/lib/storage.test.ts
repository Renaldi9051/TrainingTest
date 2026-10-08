import path from "node:path";
import { describe, expect, it } from "vitest";
import { contentTypeFor, monthFolder, resolveUploadPath } from "@/lib/storage";

const root = path.resolve("/srv/uploads");

describe("resolveUploadPath", () => {
  it("menerima path relatif normal di dalam root", () => {
    expect(resolveUploadPath("2026/10/abc.webp", root)).toBe(
      path.join(root, "2026", "10", "abc.webp"),
    );
  });

  it.each([
    "../.env",
    "2026/../../.env",
    "2026/10/../../../etc/passwd",
    "/etc/passwd",
    "C:/Windows/win.ini",
    "..\\..\\.env",
    "2026\\10\\a.webp",
    "2026//a.webp",
    "./a.webp",
    "a.webp\0.png",
    "",
  ])("menolak path traversal / path tidak valid: %j", (input) => {
    expect(resolveUploadPath(input, root)).toBeNull();
  });
});

describe("contentTypeFor", () => {
  it("hanya melayani tipe yang ditulis pipeline upload", () => {
    expect(contentTypeFor("2026/10/a.webp")).toBe("image/webp");
    expect(contentTypeFor("2026/10/a.SVG")).toBe("image/svg+xml");
    expect(contentTypeFor("2026/10/a.pdf")).toBe("application/pdf");
    expect(contentTypeFor("2026/10/a.html")).toBeNull();
    expect(contentTypeFor("2026/10/a.jpg")).toBeNull();
  });
});

describe("monthFolder", () => {
  it("memakai format yyyy/mm (UTC)", () => {
    expect(monthFolder(new Date("2026-01-31T23:59:59Z"))).toBe("2026/01");
  });
});
