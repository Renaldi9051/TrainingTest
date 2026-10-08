import { describe, expect, it } from "vitest";
import { HttpError } from "@/lib/http";
import { assertAllowedOrigin, getClientIp } from "@/lib/request";

const allowed = ["http://localhost:3000"];

function req(method: string, headers: Record<string, string> = {}) {
  return { method, headers: new Headers(headers) };
}

describe("assertAllowedOrigin", () => {
  it("membiarkan GET tanpa Origin", () => {
    expect(() => assertAllowedOrigin(req("GET"), allowed)).not.toThrow();
  });

  it.each(["POST", "PUT", "PATCH", "DELETE"])("menolak %s tanpa Origin", (method) => {
    expect(() => assertAllowedOrigin(req(method), allowed)).toThrow(HttpError);
  });

  it("menolak Origin yang tidak terdaftar dengan 403", () => {
    try {
      assertAllowedOrigin(req("POST", { origin: "https://jahat.example" }), allowed);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(HttpError);
      expect((error as HttpError).status).toBe(403);
    }
  });

  it("menerima Origin terdaftar", () => {
    expect(() =>
      assertAllowedOrigin(req("DELETE", { origin: "http://localhost:3000" }), allowed),
    ).not.toThrow();
  });

  it("membandingkan Origin persis (beda port = ditolak)", () => {
    expect(() =>
      assertAllowedOrigin(req("POST", { origin: "http://localhost:3001" }), allowed),
    ).toThrow(HttpError);
  });
});

describe("getClientIp", () => {
  it("mengambil entri X-Forwarded-For paling kanan untuk 1 proxy", () => {
    const headers = new Headers({ "x-forwarded-for": "6.6.6.6, 10.0.0.5" });
    expect(getClientIp(headers, 1)).toBe("10.0.0.5");
  });

  it("mengabaikan entri palsu di kiri sesuai jumlah proxy tepercaya", () => {
    const headers = new Headers({ "x-forwarded-for": "6.6.6.6, 203.0.113.9, 172.18.0.2" });
    expect(getClientIp(headers, 2)).toBe("203.0.113.9");
  });

  it("memakai entri pertama kalau jumlah entri kurang dari jumlah proxy", () => {
    expect(getClientIp(new Headers({ "x-forwarded-for": "203.0.113.9" }), 3)).toBe("203.0.113.9");
  });

  it("jatuh ke x-real-ip lalu 'unknown'", () => {
    expect(getClientIp(new Headers({ "x-real-ip": "198.51.100.1" }), 1)).toBe("198.51.100.1");
    expect(getClientIp(new Headers(), 1)).toBe("unknown");
  });
});
