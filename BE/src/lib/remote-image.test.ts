import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fetchRemoteImage, isBlockedAddress } from "@/lib/remote-image";

// PNG 1x1 (magic bytes asli) untuk respons server uji.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

let server: http.Server;
let base: string;

beforeAll(async () => {
  server = http.createServer((request, response) => {
    switch (request.url) {
      case "/foto.png":
        response.writeHead(200, { "Content-Type": "image/png" });
        response.end(PNG);
        return;
      case "/pindah":
        response.writeHead(302, { Location: "/foto.png" });
        response.end();
        return;
      case "/loop":
        response.writeHead(302, { Location: "/loop" });
        response.end();
        return;
      case "/halaman":
        response.writeHead(200, { "Content-Type": "text/html" });
        response.end("<html></html>");
        return;
      case "/besar":
        response.writeHead(200, { "Content-Type": "image/png" });
        response.end(Buffer.alloc(2048));
        return;
      default:
        response.writeHead(404);
        response.end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

// Server uji ada di 127.0.0.1 port acak: hanya test yang boleh melonggarkan aturan ini.
const local = { isBlocked: () => false, allowAnyPort: true };

describe("isBlockedAddress", () => {
  it.each([
    "127.0.0.1",
    "10.1.2.3",
    "172.16.5.5",
    "192.168.1.10",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "::1",
    "::",
    "fe80::1",
    "fd00::1",
    "::ffff:127.0.0.1",
    "::ffff:7f00:1",
    "bukan-ip",
  ])("memblokir %s", (address) => {
    expect(isBlockedAddress(address)).toBe(true);
  });

  it.each(["8.8.8.8", "104.16.1.1", "2606:4700::1111"])("mengizinkan alamat publik %s", (address) => {
    expect(isBlockedAddress(address)).toBe(false);
  });
});

describe("fetchRemoteImage", () => {
  it("menolak alamat internal walau portnya diizinkan", async () => {
    await expect(fetchRemoteImage(`${base}/foto.png`, { allowAnyPort: true })).rejects.toMatchObject({
      code: "URL_NOT_ALLOWED",
      fields: { url: expect.any(Array) },
    });
  });

  it("menolak localhost lewat DNS, port non-standar, dan kredensial di URL", async () => {
    await expect(fetchRemoteImage("http://localhost/a.png")).rejects.toMatchObject({ code: "URL_NOT_ALLOWED" });
    await expect(fetchRemoteImage("http://example.com:8080/a.png")).rejects.toMatchObject({ code: "URL_NOT_ALLOWED" });
    await expect(fetchRemoteImage("http://user:pass@example.com/a.png")).rejects.toMatchObject({
      code: "URL_NOT_ALLOWED",
    });
    await expect(fetchRemoteImage("ftp://example.com/a.png")).rejects.toMatchObject({ code: "INVALID_URL" });
  });

  it("mengunduh gambar dan mengambil nama file dari path", async () => {
    const image = await fetchRemoteImage(`${base}/foto.png`, local);
    expect(Buffer.from(image.data).equals(PNG)).toBe(true);
    expect(image.name).toBe("foto.png");
  });

  it("mengikuti redirect (dicek ulang), tapi dibatasi", async () => {
    expect((await fetchRemoteImage(`${base}/pindah`, local)).name).toBe("foto.png");
    await expect(fetchRemoteImage(`${base}/loop`, local)).rejects.toMatchObject({ code: "TOO_MANY_REDIRECTS" });
  });

  it("menolak halaman web, HTTP error, dan file terlalu besar", async () => {
    await expect(fetchRemoteImage(`${base}/halaman`, local)).rejects.toMatchObject({ code: "NOT_AN_IMAGE" });
    await expect(fetchRemoteImage(`${base}/hilang`, local)).rejects.toMatchObject({ code: "REMOTE_FAILED" });
    await expect(fetchRemoteImage(`${base}/besar`, { ...local, maxBytes: 1024 })).rejects.toMatchObject({
      code: "FILE_TOO_LARGE",
    });
  });
});
