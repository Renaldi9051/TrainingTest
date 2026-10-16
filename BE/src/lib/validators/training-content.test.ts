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
  MODULE_TITLE_MAX,
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
    ).toEqual([{ title: "Dari sasaran ke indikator", points: ["Peta sasaran", "SMART"], durationMinutes: 90, day: null }]);
    expect(modulesSchema.parse([{ title: "Tanpa durasi", points: [] }])[0].durationMinutes).toBeNull();
    expect(modulesSchema.safeParse([{ title: "", points: [] }]).success).toBe(false);
    expect(modulesSchema.safeParse([{ title: "X", points: [], durationMinutes: 0 }]).success).toBe(false);
    expect(modulesSchema.safeParse([{ title: "X", points: [], durationMinutes: 1.5 }]).success).toBe(false);
    expect(modulesSchema.safeParse([{ title: "X", points: Array.from({ length: 13 }, () => "p") }]).success).toBe(false);
  });

  it("judul modul sampai 300 karakter (katalog impor), 301 ditolak", () => {
    expect(MODULE_TITLE_MAX).toBe(300);
    expect(modulesSchema.safeParse([{ title: "a".repeat(300), points: [] }]).success).toBe(true);
    expect(modulesSchema.safeParse([{ title: "a".repeat(301), points: [] }]).success).toBe(false);
  });

  it("hari silabus opsional: 1-30, bilangan bulat", () => {
    expect(modulesSchema.parse([{ title: "Mengenal drone", points: [], day: 1 }])[0].day).toBe(1);
    expect(modulesSchema.parse([{ title: "Tanpa hari", points: [], day: null }])[0].day).toBeNull();
    expect(modulesSchema.safeParse([{ title: "X", points: [], day: 0 }]).success).toBe(false);
    expect(modulesSchema.safeParse([{ title: "X", points: [], day: 31 }]).success).toBe(false);
    expect(modulesSchema.safeParse([{ title: "X", points: [], day: 1.5 }]).success).toBe(false);
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

  it("modul lama tanpa `day` dibaca utuh, day = null (isi tidak berubah)", () => {
    const stored = [
      { title: "Dasar dan ruang lingkup", points: ["Konsep utama", "Istilah"], durationMinutes: null },
      { title: "Penerapan", points: ["Tahapan"], durationMinutes: 90 },
    ];
    expect(readModules(stored)).toEqual(stored.map((module) => ({ ...module, day: null })));
  });

  it("modul lama dengan judul 121-300 karakter tetap terbaca (dulu jadi kosong)", () => {
    const stored = [{ title: "J".repeat(180), points: ["Poin"], durationMinutes: null }];
    expect(readModules(stored)).toEqual([{ ...stored[0], day: null }]);
  });
});
