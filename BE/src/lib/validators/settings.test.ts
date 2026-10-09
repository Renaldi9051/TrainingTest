import { describe, expect, it } from "vitest";
import {
  isAllowedMapEmbedUrl,
  normalizeWhatsapp,
  parseStoredSetting,
  SETTING_DEFAULTS,
  SETTING_KEYS,
  settingMediaIds,
  settingSchemas,
} from "@/lib/validators/settings";

const MEDIA_ID = "0199b4d0-0000-7000-8000-000000000001";

describe("site.identity", () => {
  it("nama wajib, media berupa uuid atau null", () => {
    expect(settingSchemas["site.identity"].safeParse({ name: "" }).success).toBe(false);
    expect(settingSchemas["site.identity"].parse({ name: " Situs ", logoLightId: MEDIA_ID })).toEqual({
      name: "Situs",
      tagline: "",
      logoLightId: MEDIA_ID,
      logoDarkId: null,
      faviconId: null,
    });
    expect(settingSchemas["site.identity"].safeParse({ name: "X", faviconId: "/logo.png" }).success).toBe(
      false,
    );
  });
});

describe("site.header", () => {
  it("label dan tautan CTA diisi berpasangan, tautan internal atau http(s)", () => {
    const schema = settingSchemas["site.header"];
    expect(schema.safeParse({}).success).toBe(true);
    expect(schema.safeParse({ ctaLabel: "Konsultasi", ctaHref: "/kontak" }).success).toBe(true);
    expect(schema.safeParse({ ctaLabel: "Konsultasi", ctaHref: "https://wa.me/62812" }).success).toBe(true);
    expect(schema.safeParse({ ctaLabel: "Konsultasi" }).success).toBe(false);
    expect(schema.safeParse({ ctaLabel: "X", ctaHref: "javascript:alert(1)" }).success).toBe(false);
    expect(schema.safeParse({ ctaLabel: "X", ctaHref: "//evil.example" }).success).toBe(false);
  });
});

describe("site.contact", () => {
  it.each([
    ["+62 812-3456-7890", "6281234567890"],
    ["0812 3456 7890", "6281234567890"],
    ["6281234567890", "6281234567890"],
  ])("normalizeWhatsapp(%s) = %s", (input, expected) => {
    expect(normalizeWhatsapp(input)).toBe(expected);
  });

  it("menolak WhatsApp/email/telepon tidak valid", () => {
    const schema = settingSchemas["site.contact"];
    expect(schema.safeParse({ whatsapp: "abc" }).success).toBe(false);
    expect(schema.safeParse({ whatsapp: "123" }).success).toBe(false);
    expect(schema.safeParse({ email: "bukan-email" }).success).toBe(false);
    expect(schema.safeParse({ phone: "021<script>" }).success).toBe(false);
    expect(schema.parse({ whatsapp: "0812 3456 7890" }).whatsapp).toBe("6281234567890");
  });

  it.each([
    ["https://www.google.com/maps/embed?pb=!1m18!1m12", true],
    ["https://maps.google.com/maps?q=monas&output=embed", true],
    ["https://www.openstreetmap.org/export/embed.html?bbox=106.8,-6.2", true],
    ["http://www.google.com/maps/embed?pb=1", false],
    ["https://www.google.com/search?q=x", false],
    ["https://maps.google.com/maps?q=monas", false],
    ["https://evil.example/maps/embed", false],
    ["https://www.google.com.evil.example/maps/embed", false],
    ["https://user:pass@www.google.com/maps/embed", false],
    ['<iframe src="https://www.google.com/maps/embed?pb=1"></iframe>', false],
    ["javascript:alert(1)", false],
  ])("URL peta %s -> %s", (url, expected) => {
    expect(isAllowedMapEmbedUrl(url)).toBe(expected);
    expect(settingSchemas["site.contact"].safeParse({ mapEmbedUrl: url }).success).toBe(expected);
  });
});

describe("site.social", () => {
  it("platform dari daftar, URL http(s), maks 12", () => {
    const schema = settingSchemas["site.social"];
    expect(schema.safeParse({ links: [{ platform: "instagram", url: "https://instagram.com/x" }] }).success).toBe(
      true,
    );
    expect(schema.safeParse({ links: [{ platform: "myspace", url: "https://x.co" }] }).success).toBe(false);
    expect(schema.safeParse({ links: [{ platform: "x", url: "javascript:alert(1)" }] }).success).toBe(false);
    const many = Array.from({ length: 13 }, () => ({ platform: "x", url: "https://x.com/a" }));
    expect(schema.safeParse({ links: many }).success).toBe(false);
  });
});

describe("seo.default", () => {
  it("template judul wajib berisi %s, deskripsi maks 160", () => {
    const schema = settingSchemas["seo.default"];
    expect(schema.safeParse({ titleTemplate: "%s | Situs" }).success).toBe(true);
    expect(schema.safeParse({ titleTemplate: "Situs" }).success).toBe(false);
    expect(schema.safeParse({ description: "a".repeat(161) }).success).toBe(false);
  });
});

describe("parseStoredSetting & default", () => {
  it("semua default lolos skemanya sendiri", () => {
    for (const key of SETTING_KEYS) {
      expect(settingSchemas[key].safeParse(SETTING_DEFAULTS[key]).success, key).toBe(true);
    }
  });

  it("nilai lama yang tidak valid jatuh ke default, bukan error", () => {
    expect(parseStoredSetting("site.contact", { mapEmbedUrl: "<iframe>" })).toEqual(
      SETTING_DEFAULTS["site.contact"],
    );
    expect(parseStoredSetting("site.identity", null)).toEqual(SETTING_DEFAULTS["site.identity"]);
  });

  it("settingMediaIds mengambil field media per key", () => {
    expect(settingMediaIds("site.identity", { logoLightId: MEDIA_ID, faviconId: null })).toEqual({
      logoLightId: MEDIA_ID,
      logoDarkId: null,
      faviconId: null,
    });
    expect(settingMediaIds("site.footer", { description: "x" })).toEqual({});
  });
});
