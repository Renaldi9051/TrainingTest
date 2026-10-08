import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiFetch } from "@/lib/api/client";

function mockFetch(status: number, body: unknown) {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("apiFetch", () => {
  it("memanggil /api dan mengembalikan { data }", async () => {
    const fetchMock = mockFetch(200, { data: { status: "ok" } });

    const result = await apiFetch<{ status: string }>("health");

    expect(fetchMock).toHaveBeenCalledWith("/api/health", expect.any(Object));
    expect(result.data.status).toBe("ok");
  });

  it("melempar ApiError dengan code, message, dan fields dari BE", async () => {
    mockFetch(422, {
      error: {
        code: "VALIDATION_ERROR",
        message: "Data tidak valid",
        fields: { email: ["Wajib diisi"] },
      },
    });

    const error = await apiFetch("/public/inquiries").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 422,
      code: "VALIDATION_ERROR",
      message: "Data tidak valid",
      fields: { email: ["Wajib diisi"] },
    });
  });

  it("melempar ApiError generik kalau body error tidak sesuai format", async () => {
    mockFetch(500, { pesan: "rusak" });

    await expect(apiFetch("/health")).rejects.toMatchObject({
      status: 500,
      code: "UNKNOWN_ERROR",
    });
  });
});
