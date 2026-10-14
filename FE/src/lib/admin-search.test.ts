import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { adminSearchHref, buildAdminPaletteGroups } from "@/lib/admin-search";
import type { AdminSearchResult } from "@/lib/api/types";
import { isPaletteShortcut, moveActive } from "@/lib/command-palette";
import { parseSettingHash, SETTING_FIELDS, settingAnchor } from "@/lib/settings-fields";
import { foldText, matchesAllWords } from "@/lib/text-match";

const item = (id: string, extra: Partial<AdminSearchResult["groups"][number]["items"][number]> = {}) => ({
  id,
  title: `Judul ${id}`,
  meta: null,
  status: null,
  ...extra,
});

describe("matchesAllWords", () => {
  it("semua kata harus ada, tanpa aksen/huruf besar, urutan bebas", () => {
    expect(foldText("  Café  WA ")).toBe("cafe wa");
    expect(matchesAllWords("nomor wa", ["WhatsApp", "nomor WA"])).toBe(true);
    expect(matchesAllWords("wa nomor", ["WhatsApp", "nomor WA"])).toBe(true);
    expect(matchesAllWords("nomor wa", ["Telepon", "nomor telepon"])).toBe(false);
    expect(matchesAllWords("   ", ["apa saja"])).toBe(false);
  });
});

describe("adminSearchHref", () => {
  it("halaman edit per entitas; entitas dialog lewat ?edit=; media lewat ?media=", () => {
    expect(adminSearchHref("trainings", item("t1"))).toBe("/admin/trainings/t1");
    expect(adminSearchHref("home", item("h1"))).toBe("/admin/home/h1");
    expect(adminSearchHref("clients", item("c1"))).toBe("/admin/clients?edit=c1");
    expect(adminSearchHref("mediaPartners", item("p1"))).toBe("/admin/media-partners?edit=p1");
    expect(adminSearchHref("media", item("m1"))).toBe("/admin/media?media=m1");
    expect(adminSearchHref("navigation", item("n1"))).toBe("/admin/navigation");
    expect(adminSearchHref("settings", item("site.contact", { field: "whatsapp" }))).toBe(
      "/admin/settings#field-site.contact.whatsapp",
    );
    // Field yang tidak dikenal FE: ke halaman pengaturan saja.
    expect(adminSearchHref("settings", item("site.contact", { field: "lainnya" }))).toBe("/admin/settings");
  });
});

describe("buildAdminPaletteGroups", () => {
  it("kurang dari 2 huruf: tidak ada hasil", () => {
    expect(buildAdminPaletteGroups("w", undefined)).toEqual([]);
  });

  it("'nomor wa' menemukan field WhatsApp dari sinonim, sebelum hasil BE ada", () => {
    const groups = buildAdminPaletteGroups("nomor wa", undefined);
    expect(groups).toEqual([
      {
        id: "settings",
        label: "Pengaturan",
        items: [{ key: "setting:/admin/settings#field-site.contact.whatsapp", href: "/admin/settings#field-site.contact.whatsapp", title: "WhatsApp", meta: "Kontak" }],
      },
    ]);
  });

  it("urutan modul, pengaturan, lalu konten; draf diberi badge; label section beranda", () => {
    const result: AdminSearchResult = {
      q: "jadwal",
      groups: [
        { group: "trainings", items: [item("t1", { title: "Jadwal ujian", status: "DRAFT" })] },
        { group: "home", items: [item("h1", { title: "UPCOMING_SCHEDULES", meta: "UPCOMING_SCHEDULES" })] },
      ],
    };
    const groups = buildAdminPaletteGroups("jadwal", result);
    expect(groups.map((group) => group.id)).toEqual(["modules", "trainings", "home"]);
    expect(groups[0].items[0]).toMatchObject({ title: "Jadwal", href: "/admin/schedules" });
    expect(groups[1].items[0]).toMatchObject({ title: "Jadwal ujian", badge: "Draf" });
    expect(groups[2].items[0]).toMatchObject({ title: "Jadwal terdekat", meta: "Jadwal terdekat" });
  });

  it("nilai pengaturan dari BE tampil sebagai field-nya dengan potongan nilai; tidak dobel", () => {
    const result: AdminSearchResult = {
      q: "wa",
      groups: [{ group: "settings", items: [item("site.contact", { field: "whatsapp", title: "6281200000001" })] }],
    };
    const settings = buildAdminPaletteGroups("wa", result).find((group) => group.id === "settings");
    expect(settings?.items).toEqual([
      expect.objectContaining({ title: "WhatsApp", meta: "6281200000001", href: "/admin/settings#field-site.contact.whatsapp" }),
    ]);
  });
});

describe("palette", () => {
  it("panah berputar di ujung; -1 kalau tidak ada hasil", () => {
    expect(moveActive(0, 1, 3)).toBe(1);
    expect(moveActive(2, 1, 3)).toBe(0);
    expect(moveActive(0, -1, 3)).toBe(2);
    expect(moveActive(-1, 1, 3)).toBe(0);
    expect(moveActive(0, 1, 0)).toBe(-1);
  });

  it("Ctrl/Cmd+K saja; yang sudah ditangani (editor) diabaikan", () => {
    const key = { key: "k", ctrlKey: true, metaKey: false, shiftKey: false, altKey: false, defaultPrevented: false };
    expect(isPaletteShortcut(key)).toBe(true);
    expect(isPaletteShortcut({ ...key, ctrlKey: false, metaKey: true, key: "K" })).toBe(true);
    expect(isPaletteShortcut({ ...key, defaultPrevented: true })).toBe(false);
    expect(isPaletteShortcut({ ...key, shiftKey: true })).toBe(false);
    expect(isPaletteShortcut({ ...key, ctrlKey: false })).toBe(false);
  });
});

describe("field pengaturan", () => {
  it("hash #field-<key>.<field> dikenali; selain itu null", () => {
    expect(parseSettingHash("#field-site.contact.whatsapp")).toMatchObject({ key: "site.contact", field: "whatsapp" });
    expect(parseSettingHash("#field-site.contact.tidakada")).toBeNull();
    expect(parseSettingHash("#lain")).toBeNull();
  });

  it("setiap field yang bisa dituju punya data-anchor di form pengaturan", () => {
    const source = readFileSync(path.resolve(__dirname, "../app/admin/(panel)/settings/settings-form.tsx"), "utf8");
    const missing = SETTING_FIELDS.map((field) => settingAnchor(field.key, field.field)).filter((anchor) => {
      if (source.includes(`"${anchor}"`)) return false;
      // Pemilih media identitas memakai anchor dinamis site.identity.${name}.
      return !(anchor.startsWith("site.identity.") && anchor.endsWith("Id") && source.includes("`site.identity.${name}`"));
    });
    expect(missing).toEqual([]);
  });
});
