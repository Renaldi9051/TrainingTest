import { beforeEach, describe, expect, it, vi } from "vitest";
import type { R2Config } from "@/lib/storage";

const storage = vi.hoisted(() => ({
  r2Config: vi.fn<() => R2Config | null>(),
  getR2Object: vi.fn<(config: R2Config, key: string) => Promise<Response | null>>(),
}));

vi.mock("@/lib/storage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/storage")>()),
  r2Config: storage.r2Config,
  getR2Object: storage.getR2Object,
}));

const { GET } = await import("./route");

const r2: R2Config = {
  accountId: "0123456789abcdef0123456789abcdef",
  accessKeyId: "test-access-key",
  secretAccessKey: "test-secret-key",
  bucket: "training-media",
  publicUrl: null,
};

function get(path: string) {
  return GET(new Request(`http://localhost/uploads/${path}`), {
    params: Promise.resolve({ path: path.split("/") }),
  } as RouteContext<"/uploads/[...path]">);
}

beforeEach(() => {
  storage.r2Config.mockReset();
  storage.getR2Object.mockReset();
});

describe("GET /uploads (R2)", () => {
  it("tanpa domain publik: meneruskan file dari bucket dengan header aman", async () => {
    storage.r2Config.mockReturnValue(r2);
    storage.getR2Object.mockResolvedValue(new Response("<svg/>", { headers: { "Content-Length": "6" } }));

    const response = await get("2026/10/a.svg");

    expect(storage.getR2Object).toHaveBeenCalledWith(r2, "2026/10/a.svg");
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("<svg/>");
    expect(response.headers.get("Content-Type")).toBe("image/svg+xml");
    expect(response.headers.get("Content-Length")).toBe("6");
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=31536000, immutable");
    expect(response.headers.get("Content-Security-Policy")).toContain("sandbox");
  });

  it("tanpa domain publik: 404 kalau objek tidak ada di bucket", async () => {
    storage.r2Config.mockReturnValue(r2);
    storage.getR2Object.mockResolvedValue(null);
    expect((await get("2026/10/a.webp")).status).toBe(404);
  });

  it("dengan domain publik: redirect 308 ke domain bucket", async () => {
    storage.r2Config.mockReturnValue({ ...r2, publicUrl: "https://media.contoh.id" });

    const response = await get("2026/10/a.webp");

    expect(response.status).toBe(308);
    expect(response.headers.get("Location")).toBe("https://media.contoh.id/2026/10/a.webp");
    expect(storage.getR2Object).not.toHaveBeenCalled();
  });

  it("menolak ekstensi di luar pipeline upload dan path traversal tanpa menghubungi bucket", async () => {
    storage.r2Config.mockReturnValue(r2);
    expect((await get("2026/10/a.html")).status).toBe(404);
    expect((await get("../a.webp")).status).toBe(404);
    expect(storage.getR2Object).not.toHaveBeenCalled();
  });
});
