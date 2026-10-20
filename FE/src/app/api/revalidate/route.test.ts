import { beforeEach, describe, expect, it, vi } from "vitest";

const revalidateTag = vi.fn();
vi.mock("next/cache", () => ({ revalidateTag: (...args: unknown[]) => revalidateTag(...args) }));
vi.mock("@/lib/env", () => ({ getEnv: () => ({ REVALIDATE_SECRET: "rahasia-uji" }) }));

const { POST } = await import("./route");

function request(tags: unknown, secret = "rahasia-uji") {
  return new Request("http://localhost/api/revalidate", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-revalidate-secret": secret },
    body: JSON.stringify({ tags }),
  });
}

describe("POST /api/revalidate", () => {
  beforeEach(() => revalidateTag.mockClear());

  it("menerima tag pelatihan dengan slug terpanjang (120 karakter)", async () => {
    const tag = `training:${"a".repeat(120)}`;
    const response = await POST(request(["trainings", tag]));
    expect(response.status).toBe(200);
    expect(revalidateTag).toHaveBeenCalledWith(tag, { expire: 0 });
  });

  it("menolak secret yang salah", async () => {
    expect((await POST(request(["trainings"], "salah"))).status).toBe(401);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("menolak tag di atas batas Next.js (256) dan lebih dari 50 tag", async () => {
    expect((await POST(request(["x".repeat(257)]))).status).toBe(422);
    expect((await POST(request(Array.from({ length: 51 }, (_, index) => `tag-${index}`)))).status).toBe(422);
    expect(revalidateTag).not.toHaveBeenCalled();
  });
});
