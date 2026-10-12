import { describe, expect, it } from "vitest";
import {
  contentHrefSchema,
  ctaSchema,
  isContentHref,
  isValidHref,
  nullableHttpUrlSchema,
  whatsappSchema,
} from "@/lib/validators/common";

describe("isContentHref", () => {
  it.each([
    "/",
    "/pelatihan",
    "/pelatihan?q=kpi&kategori=hr",
    "/profil#visi",
    "https://example.com",
    "https://example.com/path?x=1",
    "HTTPS://EXAMPLE.COM",
    "mailto:halo@example.com",
    "mailto:halo@example.com?subject=Penawaran",
    "tel:+6281234567890",
    "tel:021-555-0101",
  ])("menerima %s", (href) => {
    expect(isContentHref(href)).toBe(true);
  });

  it.each([
    ["javascript:", "javascript:alert(1)"],
    ["javascript: huruf campur", "JaVaScRiPt:alert(1)"],
    ["javascript: ter-encode", "javascript%3Aalert(1)"],
    ["javascript: dengan tab", "java\tscript:alert(1)"],
    ["javascript: dengan newline", "java\nscript:alert(1)"],
    ["data:", "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=="],
    ["data: huruf besar", "DATA:text/html,<script>alert(1)</script>"],
    ["vbscript:", "vbscript:msgbox(1)"],
    ["http: (wajib https)", "http://example.com"],
    ["protocol-relative", "//evil.example"],
    ["backslash", "/\\evil.example"],
    ["https tanpa host", "https://"],
    ["relatif tanpa /", "pelatihan"],
    ["spasi di path", "/pelatihan kpi"],
    ["mailto tanpa alamat", "mailto:"],
    ["mailto bukan email", "mailto:bukan-email"],
    ["tel huruf", "tel:abc"],
    ["tel kosong", "tel:"],
    ["karakter kontrol", "/pelatihan\u0000"],
    ["ftp:", "ftp://example.com/file"],
  ])("menolak %s", (_label, href) => {
    expect(isContentHref(href)).toBe(false);
  });
});

describe("contentHrefSchema", () => {
  it("trim spasi di luar lalu cek ulang (spasi di depan javascript: tidak lolos)", () => {
    expect(contentHrefSchema.safeParse("  javascript:alert(1)").success).toBe(false);
    expect(contentHrefSchema.parse("  /jadwal  ")).toBe("/jadwal");
  });

  it("kosong ditolak dengan pesan Bahasa Indonesia", () => {
    const result = contentHrefSchema.safeParse("");
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Tautan wajib diisi.");
  });
});

describe("ctaSchema", () => {
  it("label + href aman", () => {
    expect(ctaSchema.parse({ label: " Lihat pelatihan ", href: "/pelatihan" })).toEqual({
      label: "Lihat pelatihan",
      href: "/pelatihan",
    });
  });

  it.each(["javascript:alert(document.cookie)", "data:text/html,hai"])("menolak href %s", (href) => {
    const result = ctaSchema.safeParse({ label: "Klik", href });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["href"]);
  });
});

describe("isValidHref (navigasi) tidak berubah", () => {
  it("tetap menerima http dan path internal, menolak javascript:", () => {
    expect(isValidHref("/pelatihan")).toBe(true);
    expect(isValidHref("http://example.com")).toBe(true);
    expect(isValidHref("//evil.example")).toBe(false);
    expect(isValidHref("javascript:alert(1)")).toBe(false);
  });
});

describe("whatsappSchema (wajib)", () => {
  it("menormalkan ke format wa.me", () => {
    expect(whatsappSchema.parse("0812-3456-7890")).toBe("6281234567890");
  });

  it.each(["", "abc", "0812"])("menolak %o", (value) => {
    expect(whatsappSchema.safeParse(value).success).toBe(false);
  });
});

describe("nullableHttpUrlSchema", () => {
  it("kosong jadi null, URL http(s) diterima", () => {
    expect(nullableHttpUrlSchema.parse("")).toBeNull();
    expect(nullableHttpUrlSchema.parse(null)).toBeNull();
    expect(nullableHttpUrlSchema.parse("https://klien.example")).toBe("https://klien.example");
  });

  it("menolak javascript:", () => {
    expect(nullableHttpUrlSchema.safeParse("javascript:alert(1)").success).toBe(false);
  });
});
