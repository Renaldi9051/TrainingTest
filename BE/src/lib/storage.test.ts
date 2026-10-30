import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Env } from "@/lib/env";
import {
  contentTypeFor,
  getR2Object,
  monthFolder,
  putR2Object,
  r2Config,
  r2ObjectExists,
  r2ObjectHeaders,
  resolveUploadPath,
  saveUpload,
  uploadUrl,
  type R2Config,
} from "@/lib/storage";

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

const r2: R2Config = {
  accountId: "0123456789abcdef0123456789abcdef",
  accessKeyId: "test-access-key",
  secretAccessKey: "test-secret-key",
  bucket: "training-media",
  publicUrl: "https://media.contoh.id",
};

describe("r2Config", () => {
  const base = { UPLOAD_DIR: "./uploads" } as Env;

  it("null kalau variabel R2_* kosong (penyimpanan disk)", () => {
    expect(r2Config(base)).toBeNull();
  });

  it("tanpa R2_PUBLIC_URL: publicUrl null (dilayani lewat /uploads)", () => {
    expect(
      r2Config({
        ...base,
        R2_ACCOUNT_ID: r2.accountId,
        R2_ACCESS_KEY_ID: r2.accessKeyId,
        R2_SECRET_ACCESS_KEY: r2.secretAccessKey,
        R2_BUCKET: r2.bucket,
      }),
    ).toEqual({ ...r2, publicUrl: null });
  });

  it("terisi kalau semua variabel R2_* ada", () => {
    expect(
      r2Config({
        ...base,
        R2_ACCOUNT_ID: r2.accountId,
        R2_ACCESS_KEY_ID: r2.accessKeyId,
        R2_SECRET_ACCESS_KEY: r2.secretAccessKey,
        R2_BUCKET: r2.bucket,
        R2_PUBLIC_URL: "https://media.contoh.id",
      }),
    ).toEqual(r2);
  });
});

describe("uploadUrl", () => {
  it("disk: path /uploads relatif terhadap origin", () => {
    expect(uploadUrl("2026/10/a.webp", null)).toBe("/uploads/2026/10/a.webp");
  });

  it("R2: URL absolut di domain publik bucket", () => {
    expect(uploadUrl("2026/10/a.webp", r2)).toBe("https://media.contoh.id/2026/10/a.webp");
  });

  it("R2 tanpa domain publik: tetap /uploads (diteruskan BE dari bucket)", () => {
    expect(uploadUrl("2026/10/a.webp", { ...r2, publicUrl: null })).toBe("/uploads/2026/10/a.webp");
  });
});

describe("r2ObjectHeaders", () => {
  it("menyetel tipe konten dan cache immutable", () => {
    expect(r2ObjectHeaders("2026/10/a.webp")).toEqual({
      "Content-Type": "image/webp",
      "Cache-Control": "public, max-age=31536000, immutable",
    });
  });

  it("SVG diunduh kalau dibuka langsung, PDF tampil inline", () => {
    expect(r2ObjectHeaders("2026/10/a.svg")["Content-Disposition"]).toBe("attachment");
    expect(r2ObjectHeaders("2026/10/a.pdf")["Content-Disposition"]).toBe("inline");
  });

  it("menolak ekstensi di luar pipeline upload", () => {
    expect(() => r2ObjectHeaders("2026/10/a.html")).toThrow();
  });
});

describe("R2 (S3 API)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubFetch(response: Response) {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(response);
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("saveUpload mengirim PUT bertanda tangan ke endpoint bucket", async () => {
    const fetchMock = stubFetch(new Response(null, { status: 200 }));
    await saveUpload("2026/10/a.webp", new Uint8Array([1, 2, 3]), r2);

    expect(fetchMock).toHaveBeenCalledOnce();
    const request = fetchMock.mock.calls[0][0] as Request;
    expect(request.method).toBe("PUT");
    expect(request.url).toBe(`https://${r2.accountId}.r2.cloudflarestorage.com/training-media/2026/10/a.webp`);
    expect(request.headers.get("Content-Type")).toBe("image/webp");
    expect(request.headers.get("Authorization")).toMatch(/^AWS4-HMAC-SHA256 Credential=test-access-key\/\d{8}\/auto\/s3\//);
  });

  it("melempar error kalau R2 menolak upload", async () => {
    stubFetch(new Response("<Error><Code>AccessDenied</Code></Error>", { status: 403 }));
    await expect(putR2Object(r2, "2026/10/a.webp", new Uint8Array([1]))).rejects.toThrow(/403/);
  });

  it("menolak key dengan path traversal sebelum ada request", async () => {
    const fetchMock = stubFetch(new Response(null, { status: 200 }));
    await expect(putR2Object(r2, "../a.webp", new Uint8Array([1]))).rejects.toThrow(/tidak valid/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // Timer asli (jeda 0,5 s + 1 s): fake timer tidak cocok dengan penandatanganan crypto.subtle yang asinkron.
  it("mengulang error jaringan sesaat, lalu berhasil", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(putR2Object(r2, "2026/10/a.webp", new Uint8Array([1]))).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("menyerah setelah 3 kali error jaringan", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockRejectedValue(new TypeError("fetch failed"));
    vi.stubGlobal("fetch", fetchMock);
    await expect(r2ObjectExists(r2, "2026/10/a.webp")).rejects.toThrow(/Koneksi ke R2 gagal/);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("getR2Object: respons objek, atau null kalau 404", async () => {
    const fetchMock = stubFetch(new Response("isi", { status: 200 }));
    const object = await getR2Object(r2, "2026/10/a.webp");
    expect(await object?.text()).toBe("isi");
    expect((fetchMock.mock.calls[0][0] as Request).method).toBe("GET");
    stubFetch(new Response(null, { status: 404 }));
    expect(await getR2Object(r2, "2026/10/a.webp")).toBeNull();
  });

  it("r2ObjectExists: 200 = ada, 404 = belum ada", async () => {
    stubFetch(new Response(null, { status: 200 }));
    expect(await r2ObjectExists(r2, "2026/10/a.webp")).toBe(true);
    stubFetch(new Response(null, { status: 404 }));
    expect(await r2ObjectExists(r2, "2026/10/a.webp")).toBe(false);
  });
});
