import { describe, expect, it } from "vitest";
import { type CategoryCandidate, pickPrimaryCategory } from "./primary-category";

const cat = (slug: string, extra: Partial<CategoryCandidate> = {}): CategoryCandidate => ({
  id: slug,
  slug,
  name: slug.charAt(0).toUpperCase() + slug.slice(1),
  keywords: [],
  order: 100,
  inMenu: false,
  ...extra,
});

const pick = (title: string, current: CategoryCandidate[], all: CategoryCandidate[] = []) =>
  pickPrimaryCategory(title, current, all)?.slug ?? null;

describe("pickPrimaryCategory", () => {
  const drone = cat("drone", { keywords: ["drone"] });
  const pemetaan = cat("pemetaan", { keywords: ["pemetaan"] });
  const geology = cat("geology", { inMenu: true, order: 1 });

  it("kata kunci + prioritas: pelatihan drone masuk Drone walau ada Pemetaan/Geology", () => {
    expect(pick("Training Pemetaan Menggunakan Drone", [geology, cat("slider"), drone, pemetaan])).toBe("drone");
    expect(pick("Pelatihan Pemetaan dan Survei", [geology, pemetaan])).toBe("pemetaan");
  });

  it("nama kategori di judul mengalahkan menu/urutan; generik hanya kalau tidak ada pilihan", () => {
    const audit = cat("audit");
    const banking = cat("banking", { inMenu: true, order: 0 });
    expect(pick("Training Audit Intern BPR", [banking, audit])).toBe("audit");
    expect(pick("Training Lain", [cat("training", { inMenu: true, order: 0 }), banking])).toBe("banking");
  });

  it("tanpa petunjuk judul: menu header, lalu urutan, lalu slug", () => {
    expect(pick("Kelas Umum", [cat("b", { order: 1 }), cat("a", { order: 2, inMenu: true })])).toBe("a");
    expect(pick("Kelas Umum", [cat("b", { order: 1 }), cat("a", { order: 2 })])).toBe("b");
    expect(pick("Kelas Umum", [cat("b"), cat("a")])).toBe("a");
  });

  it("hanya generik: cari kategori bertopik lain dari judul; kalau tidak ada tetap generik", () => {
    const budgeting = cat("budgeting");
    const all = [budgeting, cat("slider"), cat("uncategorized"), cat("management", { inMenu: true })];
    expect(pick("Training Financial Budgeting", [cat("slider")], all)).toBe("budgeting");
    expect(pick("Training First Line Manager (FLM)", [cat("uncategorized")], all)).toBe("uncategorized");
    expect(pick("Apa saja", [], all)).toBeNull();
  });
});
