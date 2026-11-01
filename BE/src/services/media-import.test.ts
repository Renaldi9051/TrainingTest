import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockDb, type MockDb } from "@/test/mock-db";

const db = vi.hoisted(() => ({ current: undefined as unknown }));
vi.mock("@/lib/db", () => ({ getDb: () => db.current }));
vi.mock("@/lib/revalidate", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/revalidate")>()),
  revalidateTags: vi.fn(async () => true),
}));
const saved = vi.hoisted(() => [] as string[]);
vi.mock("@/lib/storage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/storage")>()),
  saveUpload: vi.fn(async (relativePath: string) => {
    saved.push(relativePath);
  }),
}));
const remote = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("@/lib/remote-image", () => ({ fetchRemoteImage: remote.fetch }));

import { importMediaFromUrl } from "@/services/media";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

let mock: MockDb;

beforeEach(() => {
  mock = createMockDb();
  db.current = mock;
  saved.length = 0;
  remote.fetch.mockReset();
  mock.media.create.mockImplementation(async ({ data }) => ({
    id: "0199b4d0-0000-7000-8000-000000000001",
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    updatedById: "u1",
    ...data,
  }));
});

describe("importMediaFromUrl", () => {
  it("gambar dari URL disimpan sebagai WebP dengan alt, URL asal dicatat di audit", async () => {
    remote.fetch.mockResolvedValue({ data: new Uint8Array(PNG), name: "drone.png" });
    const media = await importMediaFromUrl(
      { url: "https://images.example.com/drone.png", alt: "Drone di lapangan", folder: "Artikel" },
      "u1",
    );
    expect(media).toMatchObject({ mime: "image/webp", alt: "Drone di lapangan", folder: "Artikel", originalName: "drone.png" });
    expect(saved.some((path) => path.endsWith(".webp"))).toBe(true);
    expect(mock.auditLog.create.mock.calls[0][0].data.diff).toMatchObject({
      sourceUrl: "https://images.example.com/drone.png",
    });
  });

  it("SVG/PDF dari URL ditolak, tidak ada yang disimpan", async () => {
    remote.fetch.mockResolvedValue({
      data: new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>'),
      name: "logo.svg",
    });
    await expect(
      importMediaFromUrl({ url: "https://example.com/logo.svg", alt: "Logo", folder: null }, "u1"),
    ).rejects.toMatchObject({ status: 422, code: "UNSUPPORTED_TYPE", fields: { url: expect.any(Array) } });
    expect(saved).toHaveLength(0);
    expect(mock.media.create).not.toHaveBeenCalled();
  });
});
