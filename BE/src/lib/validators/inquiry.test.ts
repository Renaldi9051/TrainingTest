import { describe, expect, it } from "vitest";
import { CONSENT_VERSION, inquiryCreateSchema, inquiryListQuerySchema, inquiryUpdateSchema } from "@/lib/validators/inquiry";

const base = { name: "Rina Contoh", email: " Rina@Example.COM ", consent: true };

describe("inquiryCreateSchema", () => {
  it("minimal: nama, email (di-lowercase), persetujuan; sisanya null/default", () => {
    expect(inquiryCreateSchema.parse(base)).toEqual({
      name: "Rina Contoh",
      company: null,
      email: "rina@example.com",
      phone: null,
      trainingSlug: null,
      interest: null,
      message: null,
      source: "CONTACT",
      consent: true,
      website: "",
    });
    expect(CONSENT_VERSION).toMatch(/^\d{4}-\d{2}$/);
  });

  it("nomor WA dinormalisasi ke format wa.me", () => {
    expect(inquiryCreateSchema.parse({ ...base, phone: "0812-3456-7890" }).phone).toBe("6281234567890");
    expect(inquiryCreateSchema.parse({ ...base, phone: "+62 812 3456 7890" }).phone).toBe("6281234567890");
    expect(inquiryCreateSchema.safeParse({ ...base, phone: "12ab" }).success).toBe(false);
  });

  it.each([
    ["tanpa persetujuan", { ...base, consent: false }, "consent"],
    ["persetujuan tidak dikirim", { name: "Rina", email: "r@example.com" }, "consent"],
    ["nama 1 huruf", { ...base, name: "R" }, "name"],
    ["email salah", { ...base, email: "bukan-email" }, "email"],
    ["pesan > 2000", { ...base, message: "x".repeat(2001) }, "message"],
    ["slug pelatihan > 200", { ...base, trainingSlug: "x".repeat(201) }, "trainingSlug"],
    ["sumber asing", { ...base, source: "SPAM" }, "source"],
  ])("ditolak: %s", (_label, input, path) => {
    const result = inquiryCreateSchema.safeParse(input);
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path.join("."))).toContain(path);
  });
});

describe("admin", () => {
  it("update: status/catatan, kosong ditolak", () => {
    expect(inquiryUpdateSchema.parse({ status: "IN_PROGRESS" })).toEqual({ status: "IN_PROGRESS" });
    expect(inquiryUpdateSchema.parse({ note: "  " })).toEqual({ note: null });
    expect(inquiryUpdateSchema.safeParse({}).success).toBe(false);
    expect(inquiryUpdateSchema.safeParse({ status: "SPAM" }).success).toBe(false);
  });

  it("list: default urut terbaru, filter status & tanggal", () => {
    const query = inquiryListQuerySchema.parse({ status: "NEW", from: "2026-10-01" });
    expect(query.sort).toEqual({ field: "createdAt", direction: "desc" });
    expect(query.status).toBe("NEW");
    expect(inquiryListQuerySchema.safeParse({ from: "01-10-2026" }).success).toBe(false);
  });
});
