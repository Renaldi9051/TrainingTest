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

  it("di antara kategori menu, nama di judul menang; generik hanya kalau tidak ada pilihan", () => {
    const audit = cat("audit", { inMenu: true, order: 5 });
    const banking = cat("banking", { inMenu: true, order: 0 });
    expect(pick("Training Audit Intern BPR", [banking, audit])).toBe("audit");
    expect(pick("Training Audit Intern BPR", [banking, cat("audit")])).toBe("banking");
    expect(pick("Training Lain", [cat("training", { inMenu: true, order: 0 }), banking])).toBe("banking");
  });

  it("tanpa petunjuk judul: menu header, lalu urutan, lalu slug", () => {
    expect(pick("Kelas Umum", [cat("b", { order: 1 }), cat("a", { order: 2, inMenu: true })])).toBe("a");
    expect(pick("Kelas Umum", [cat("b", { order: 1 }), cat("a", { order: 2 })])).toBe("b");
    expect(pick("Kelas Umum", [cat("b"), cat("a")])).toBe("a");
  });

  it("menu utama dulu: kategori menu milik pelatihan > kategori lain yang namanya ada di judul", () => {
    const management = cat("management", { inMenu: true });
    const it_ = cat("information-technology", { name: "Information Technology", inMenu: true, order: 0 });
    const carbon = cat("carbon-trading", { name: "Carbon Trading" });
    const all = [cat("project-management", { name: "PROJECT MANAGEMENT" }), carbon];
    expect(pick("Training IT Project Management", [it_, management], all)).toBe("management");
    expect(pick("Legal Aspect Carbon Trading", [cat("coal-mining", { inMenu: true }), carbon], all)).toBe("coal-mining");
    expect(pick("Carbon Trading Di Sektor Industri", [cat("coal-mining", { inMenu: true })], all)).toBe("coal-mining");
    expect(pick("Kelas Umum", [cat("b", { order: 1 }), cat("a", { order: 2, inMenu: true })])).toBe("a");
  });

  it("tanpa kategori menu: kategori lain yang namanya ada di judul ikut bersaing, nama terpanjang menang", () => {
    const carbon = cat("carbon-trading", { name: "Carbon Trading" });
    const all = [carbon, cat("trading"), cat("management"), cat("project-management", { name: "PROJECT MANAGEMENT" })];
    expect(pick("Carbon Trading Di Sektor Industri", [cat("coal-mining")], all)).toBe("carbon-trading");
    expect(pick("Training IT Project Management", [cat("information-technology")], all)).toBe("project-management");
  });

  it("tag luas kalah dari kategori bertopik walau ada di menu", () => {
    const education = cat("education", { inMenu: true, order: 0 });
    expect(pick("Effective Receiving and Warehousing", [education, cat("inventory")])).toBe("inventory");
    expect(pick("Kelas Umum", [education])).toBe("education");
  });

  it("hanya generik: cari kategori bertopik lain dari judul; kalau tidak ada tetap generik", () => {
    const budgeting = cat("budgeting");
    const all = [budgeting, cat("slider"), cat("uncategorized"), cat("management", { inMenu: true })];
    expect(pick("Training Financial Budgeting", [cat("slider")], all)).toBe("budgeting");
    expect(pick("Training First Line Manager (FLM)", [cat("uncategorized")], all)).toBe("uncategorized");
    expect(pick("Apa saja", [], all)).toBeNull();
  });
});
