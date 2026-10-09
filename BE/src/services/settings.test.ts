import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockDb, passThroughTransactions, type MockDb } from "@/test/mock-db";

const db = vi.hoisted(() => ({ current: undefined as unknown }));
vi.mock("@/lib/db", () => ({ getDb: () => db.current }));
const revalidate = vi.hoisted(() => vi.fn());
vi.mock("@/lib/revalidate", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/revalidate")>()),
  revalidateTags: revalidate,
}));

import { getPublicSettings, updateSetting } from "@/services/settings";

const LOGO_ID = "0199b4d0-0000-7000-8000-000000000001";
let mock: MockDb;

beforeEach(() => {
  mock = createMockDb();
  db.current = mock;
  passThroughTransactions(mock);
  revalidate.mockReset();
  mock.siteSetting.findMany.mockResolvedValue([]);
  mock.media.findMany.mockResolvedValue([]);
  mock.siteSetting.upsert.mockResolvedValue({ id: "s1" });
});

describe("updateSetting", () => {
  it("menyimpan, menulis audit dengan diff field yang berubah, lalu revalidate tag settings", async () => {
    mock.siteSetting.findUnique.mockResolvedValue({
      id: "s1",
      key: "site.footer",
      value: { description: "Lama", copyright: "© 2026" },
    });

    await updateSetting("site.footer", { description: "Baru", copyright: "© 2026" }, "u1");

    expect(mock.siteSetting.upsert.mock.calls[0][0]).toMatchObject({
      where: { key: "site.footer" },
      update: { value: { description: "Baru", copyright: "© 2026" } },
    });
    expect(mock.auditLog.create.mock.calls[0][0].data).toMatchObject({
      action: "UPDATE",
      entity: "SiteSetting",
      diff: { key: "site.footer", changes: { description: { from: "Lama", to: "Baru" } } },
    });
    expect(revalidate).toHaveBeenCalledWith(["settings"]);
  });

  it("422 per field kalau mediaId bukan gambar aktif; tidak ada yang disimpan", async () => {
    mock.media.findMany.mockResolvedValue([]);
    await expect(
      updateSetting("site.identity", { name: "Situs", logoLightId: LOGO_ID }, "u1"),
    ).rejects.toMatchObject({ status: 422, fields: { logoLightId: [expect.any(String)] } });
    expect(mock.siteSetting.upsert).not.toHaveBeenCalled();
    expect(revalidate).not.toHaveBeenCalled();
  });

  it("menolak nilai yang tidak lolos skema key", async () => {
    await expect(updateSetting("seo.default", { titleTemplate: "Tanpa placeholder" }, "u1")).rejects.toThrow();
    expect(mock.siteSetting.upsert).not.toHaveBeenCalled();
  });
});

describe("getPublicSettings", () => {
  it("melengkapi logo dengan data gambar dan membuat URL WhatsApp", async () => {
    mock.siteSetting.findMany.mockResolvedValue([
      { key: "site.identity", value: { name: "Situs", logoLightId: LOGO_ID } },
      { key: "site.contact", value: { whatsapp: "6281234567890" } },
    ]);
    mock.media.findMany.mockResolvedValue([
      {
        id: LOGO_ID,
        path: "2026/10/logo.svg",
        originalName: "logo.svg",
        mime: "image/svg+xml",
        size: 10,
        width: 100,
        height: 40,
        alt: "Logo",
        folder: null,
        variants: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        updatedById: null,
      },
    ]);

    const settings = await getPublicSettings();
    expect(settings.identity.logoLight).toEqual({
      url: "/uploads/2026/10/logo.svg",
      alt: "Logo",
      width: 100,
      height: 40,
      mime: "image/svg+xml",
      variants: null,
    });
    expect(settings.identity.logoDark).toBeNull();
    expect(settings.contact.whatsappUrl).toBe("https://wa.me/6281234567890");
    // Judul default jatuh ke nama situs kalau kosong.
    expect(settings.seo.defaultTitle).toBe("Situs");
  });
});
