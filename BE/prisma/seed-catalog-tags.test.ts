import { describe, expect, it } from "vitest";
import type { RestCategory, RestSource } from "./seed-catalog-rest";
import { planCatalogTags, type TagTraining } from "./seed-catalog-tags";

const category = (slug: string, activeTrainings: number): RestCategory => ({
  id: `id-${slug}`,
  slug,
  name: slug,
  keywords: [],
  order: 0,
  inMenu: false,
  activeTrainings,
});

let nextId = 1;
const source = (slug: string, title: string, categorySlugs: string[]): RestSource => ({
  slug,
  categorySlugs,
  post: { id: nextId++, slug, title, categoryIds: [], date: "2026-01-01T00:00:00" },
});

const training = (slug: string, title: string, categoryIds: string[], adminChanged = false): TagTraining => ({
  id: `t-${slug}`,
  slug,
  title,
  categoryIds,
  adminChanged,
});

const categories = [category("accounting", 10), category("customer", 10), category("management", 20), category("kosong", 0), category("perpajakan", 10)];

describe("kategori tambahan referensi", () => {
  it("menambah kategori sumber yang belum tertaut; kategori utama/tautan lama tidak disentuh", () => {
    const plan = planCatalogTags({
      sources: [source("pelatihan-customer", "PELATIHAN CUSTOMER SERVICE", ["accounting", "customer", "management"])],
      categories,
      trainings: [training("pelatihan-customer", "Pelatihan Customer Service", ["id-customer"])],
    });
    expect(plan.adds).toEqual([
      { trainingId: "t-pelatihan-customer", slug: "pelatihan-customer", fromIds: ["id-customer"], addIds: ["id-accounting", "id-management"] },
    ]);
    expect(plan.summary).toEqual([
      { slug: "accounting", before: 10, after: 11 },
      { slug: "management", before: 20, after: 21 },
    ]);
  });

  it("hanya kategori yang tampil dan tidak di daftar lewati", () => {
    const plan = planCatalogTags({
      sources: [source("training-pajak", "TRAINING PAJAK", ["accounting", "kosong", "perpajakan"])],
      categories,
      trainings: [training("training-pajak", "Training Pajak", ["id-customer"])],
    });
    expect(plan.adds[0].addIds).toEqual(["id-accounting"]);
  });

  it("cocok lewat judul kalau slug beda; tanpa sumber dan diubah admin dilewati", () => {
    const plan = planCatalogTags({
      sources: [
        source("training-audit-mutu", "TRAINING AUDIT MUTU", ["accounting", "management"]),
        source("pelatihan-budget", "PELATIHAN BUDGET", ["accounting"]),
      ],
      categories,
      trainings: [
        training("audit-mutu-lain", "Training Audit Mutu", ["id-accounting"]),
        training("pelatihan-budget", "Pelatihan Budget", ["id-customer"], true),
        training("judul-sendiri", "Pelatihan Original", ["id-customer"]),
      ],
    });
    expect(plan.adds.map((add) => [add.slug, add.addIds])).toEqual([["audit-mutu-lain", ["id-management"]]]);
    expect(plan.skipped).toEqual({ noSource: 1, adminChanged: 1 });
  });
});
