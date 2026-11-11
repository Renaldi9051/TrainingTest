import { describe, expect, it } from "vitest";
import { localRedirect } from "./local-redirect";

describe("localRedirect", () => {
  it("Location relatif, tidak bergantung host server (0.0.0.0 di container)", () => {
    const response = localRedirect("/galeri");
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("/galeri");
    expect(localRedirect("/", 303).status).toBe(303);
  });

  it("menolak URL luar (bukan open redirect)", () => {
    expect(() => localRedirect("https://contoh.com")).toThrow();
    expect(() => localRedirect("//contoh.com")).toThrow();
  });
});
