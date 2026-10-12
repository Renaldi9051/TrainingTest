import { describe, expect, it } from "vitest";
import { slugSchema } from "../../src/lib/slug";
import { buildAll } from "./build";
import { categories, schedules, trainings } from "./catalog";
import * as content from "./content";

// Data contoh dipakai seed & skrip sinkronisasi training_dev: harus lolos validator API dan
// tidak memuat data kontak sungguhan.
describe("data contoh", () => {
  it("semua konten lolos validator API", () => {
    const built = buildAll();
    expect(built.services).toHaveLength(4);
    expect(built.clients).toHaveLength(12);
    expect(built.testimonials).toHaveLength(3);
    expect(built.portfolio).toHaveLength(6);
    expect(built.marketing).toHaveLength(5);
    expect(built.mediaPartners).toHaveLength(3);
    expect(built.homeSections.map((section) => section.type)).toEqual([
      "HERO",
      "SERVICES",
      "VISION_MISSION",
      "CLIENTS",
      "LATEST_TRAININGS",
      "STATS",
      "CATEGORIES",
      "UPCOMING_SCHEDULES",
      "TESTIMONIALS",
      "CTA",
    ]);
    expect(built.homeSections.every((section) => section.visible)).toBe(true);
    expect(built.profileBlocks.map((block) => block.type)).toEqual([
      "RICH_TEXT",
      "SERVICES",
      "VISION_MISSION",
      "FEATURES",
      "LIST",
      "LIST",
      "DOWNLOAD",
    ]);
  });

  it("kategori: 75 slug valid & unik, 8-12 unggulan", () => {
    expect(categories).toHaveLength(75);
    for (const category of categories) expect(slugSchema.safeParse(category.slug).success, category.slug).toBe(true);
    expect(new Set(categories.map((category) => category.slug)).size).toBe(categories.length);
    expect(new Set(categories.map((category) => category.name)).size).toBe(categories.length);
    const featured = categories.filter((category) => category.featured).length;
    expect(featured).toBeGreaterThanOrEqual(8);
    expect(featured).toBeLessThanOrEqual(12);
  });

  it("pelatihan & jadwal merujuk data yang ada; kategori unggulan punya pelatihan", () => {
    const slugs = new Set(categories.map((category) => category.slug));
    expect(trainings).toHaveLength(12);
    for (const training of trainings) expect(slugs.has(training.categorySlug), training.categorySlug).toBe(true);
    const trainingSlugs = new Set(trainings.map((training) => training.slug));
    for (const schedule of schedules) expect(trainingSlugs.has(schedule.trainingSlug)).toBe(true);
    const used = new Set(trainings.map((training) => training.categorySlug));
    for (const category of categories.filter((item) => item.featured)) expect(used.has(category.slug), category.slug).toBe(true);
  });

  it("menu sesuai struktur yang disepakati", () => {
    expect(content.headerNav.map((item) => [item.label, item.href])).toEqual([
      ["Beranda", "/"],
      ["Profil", "/profil"],
      ["Layanan", "/layanan"],
      ["Pelatihan", "/pelatihan"],
      ["Jadwal Training", "/jadwal"],
      ["Evaluasi", "/evaluasi"],
    ]);
    expect(content.headerNav[1].children).toEqual([{ label: "Portofolio", href: "/profil/portofolio" }]);
    expect(content.headerNav[2].children?.map((child) => child.href)).toEqual(
      content.services.map((service) => `/layanan/${service.slug}`),
    );
    expect(content.footerNav.map((item) => item.href)).toEqual(["/syarat-dan-ketentuan", "/kebijakan-privasi", "/kontak"]);
  });

  it("kontak dummy: email example.com, nomor 0812-0000-000x, tanpa domain referensi", () => {
    const built = buildAll();
    const contact = built.settings["site.contact"];
    expect([contact.email, contact.emailSecondary].every((email) => email.endsWith("@example.com"))).toBe(true);
    expect(built.marketing.map((item) => item.phone)).toEqual([1, 2, 3, 4, 5].map((n) => `628120000000${n}`));
    expect(built.mediaPartners.every((partner) => /^https:\/\/contoh-[a-z]+\.id$/.test(partner.url ?? ""))).toBe(true);
    expect(JSON.stringify({ content, categories, trainings }).toLowerCase()).not.toContain("diotraining");
    expect(content.clients.every((name) => name.startsWith("PT Contoh "))).toBe(true);
  });
});
