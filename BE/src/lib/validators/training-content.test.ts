import { describe, expect, it } from "vitest";
import {
  descriptionSchema,
  facilitiesSchema,
  faqSchema,
  modulesSchema,
  outcomesSchema,
  publishIssues,
  readFacilities,
  readModules,
  audienceSchema,
} from "@/lib/validators/training-content";

const paragraph = (text: string) => ({ type: "paragraph", content: [{ type: "text", text }] });

describe("outcomes", () => {
  it("item maks 160 karakter, maksimal 8 item; draf boleh kurang dari 4", () => {
    expect(outcomesSchema.parse([" Menyusun KPI "])).toEqual(["Menyusun KPI"]);
    expect(outcomesSchema.safeParse(["a".repeat(161)]).success).toBe(false);
    expect(outcomesSchema.safeParse(Array.from({ length: 9 }, (_, i) => `Hasil ${i}`)).success).toBe(false);
    expect(outcomesSchema.safeParse([""]).success).toBe(false);
  });

  it("publishIssues: wajib 4-8 hasil belajar untuk tayang", () => {
    expect(publishIssues({ outcomes: ["a", "b", "c"] })[0]).toMatchObject({ field: "outcomes" });
    expect(publishIssues({ outcomes: ["a", "b", "c", "d"] })).toEqual([]);
    expect(publishIssues({ outcomes: Array.from({ length: 8 }, () => "x") })).toEqual([]);
  });
});

describe("modules", () => {
  it("judul, poin, durasi menit opsional", () => {
    expect(
      modulesSchema.parse([{ title: "Dari sasaran ke indikator", points: ["Peta sasaran", "SMART"], durationMinutes: 90 }]),
    ).toEqual([{ title: "Dari sasaran ke indikator", points: ["Peta sasaran", "SMART"], durationMinutes: 90 }]);
    expect(modulesSchema.parse([{ title: "Tanpa durasi", points: [] }])[0].durationMinutes).toBeNull();
    expect(modulesSchema.safeParse([{ title: "", points: [] }]).success).toBe(false);
    expect(modulesSchema.safeParse([{ title: "X", points: [], durationMinutes: 0 }]).success).toBe(false);
    expect(modulesSchema.safeParse([{ title: "X", points: [], durationMinutes: 1.5 }]).success).toBe(false);
    expect(modulesSchema.safeParse([{ title: "X", points: Array.from({ length: 13 }, () => "p") }]).success).toBe(false);
  });
});

describe("audience, facilities, faq", () => {
  it("peserta: role wajib, note opsional (kosong -> null)", () => {
    expect(audienceSchema.parse([{ role: "Kepala unit", note: "" }])).toEqual([{ role: "Kepala unit", note: null }]);
    expect(audienceSchema.safeParse([{ role: "" }]).success).toBe(false);
  });

  it("fasilitas: null = pakai default global", () => {
    expect(facilitiesSchema.parse(null)).toBeNull();
    expect(facilitiesSchema.parse(["Modul cetak"])).toEqual(["Modul cetak"]);
  });

  it("faq: pertanyaan & jawaban wajib", () => {
    expect(faqSchema.safeParse([{ q: "Ada sertifikat?", a: "Ada." }]).success).toBe(true);
    expect(faqSchema.safeParse([{ q: "Ada sertifikat?", a: "" }]).success).toBe(false);
  });
});

describe("description", () => {
  it("rich text dengan batas panjang", () => {
    expect(descriptionSchema.safeParse({ type: "doc", content: [paragraph("Isi singkat.")] }).success).toBe(true);
    expect(descriptionSchema.safeParse({ type: "doc", content: [paragraph("a".repeat(1501))] }).success).toBe(false);
  });
});

describe("pembacaan kolom JSON dari DB", () => {
  it("data rusak jadi nilai kosong, bukan error", () => {
    expect(readModules({ type: "doc" })).toEqual([]);
    expect(readFacilities({ type: "doc" })).toBeNull();
    expect(readFacilities(null)).toBeNull();
  });
});
