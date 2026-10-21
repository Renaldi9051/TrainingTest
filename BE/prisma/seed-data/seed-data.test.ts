import { describe, expect, it } from "vitest";
import { slugSchema } from "../../src/lib/slug";
import { buildAll } from "./build";
import { buildSchedules, categories, publishOrder, trainings } from "./catalog";
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
      "MARQUEE",
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

  it("kategori: 15 slug valid & unik, 8 unggulan dengan semua kategori drone", () => {
    expect(categories).toHaveLength(15);
    for (const category of categories) expect(slugSchema.safeParse(category.slug).success, category.slug).toBe(true);
    expect(new Set(categories.map((category) => category.slug)).size).toBe(15);
    const featured = categories.filter((category) => category.featured);
    expect(featured).toHaveLength(8);
    expect(categories.slice(0, 7).every((category) => category.featured)).toBe(true);
  });

  it("pelatihan: 20-25 per kategori, slug unik, kategori kedua valid, variasi level/metode/tipe", () => {
    const slugs = new Set(categories.map((category) => category.slug));
    expect(new Set(trainings.map((training) => training.slug)).size).toBe(trainings.length);
    for (const category of categories) {
      const count = trainings.filter((training) => training.categorySlugs[0] === category.slug).length;
      expect(count, category.slug).toBeGreaterThanOrEqual(20);
      expect(count, category.slug).toBeLessThanOrEqual(25);
      // Termasuk pelatihan yang memakai kategori ini sebagai kategori kedua.
      const total = trainings.filter((training) => training.categorySlugs.includes(category.slug)).length;
      expect(total, category.slug).toBeLessThanOrEqual(25);
    }
    for (const training of trainings) {
      expect(training.categorySlugs.every((slug) => slugs.has(slug)), training.slug).toBe(true);
      expect(new Set(training.categorySlugs).size).toBe(training.categorySlugs.length);
      expect(training.outcomes.length).toBeGreaterThanOrEqual(3);
      expect(training.modules.length).toBeGreaterThanOrEqual(3);
      expect(training.audience.length).toBeGreaterThanOrEqual(2);
      expect(training.priceText).toMatch(/^Rp[\d.]+ per peserta$/);
    }
    // Satu pelatihan satu kategori.
    expect(trainings.every((training) => training.categorySlugs.length === 1)).toBe(true);
    expect(new Set(trainings.map((training) => training.level))).toEqual(new Set(["dasar", "menengah", "lanjut"]));
    expect(new Set(trainings.map((training) => training.method))).toEqual(new Set(["ONLINE", "OFFLINE", "HYBRID"]));
    expect(new Set(trainings.map((training) => training.types.join("+")))).toEqual(new Set(["PUBLIC+IN_HOUSE", "PUBLIC"]));
    expect(new Set(publishOrder())).toEqual(new Set(trainings.map((training) => training.slug)));
  });

  it("jadwal: 2-3 sesi per pelatihan dalam 6 bulan ke depan, status campuran", () => {
    const today = "2026-10-12";
    const schedules = buildSchedules(today);
    for (const training of trainings) {
      const count = schedules.filter((schedule) => schedule.trainingSlug === training.slug).length;
      expect(count).toBeGreaterThanOrEqual(2);
      expect(count).toBeLessThanOrEqual(3);
    }
    for (const schedule of schedules) {
      expect(schedule.startDate > today).toBe(true);
      expect(schedule.startDate <= "2027-04-12").toBe(true);
      expect(schedule.endDate >= schedule.startDate).toBe(true);
      expect(schedule.method === "ONLINE" ? schedule.city === null : schedule.city !== null).toBe(true);
    }
    expect(new Set(schedules.map((schedule) => schedule.status))).toEqual(new Set(["OPEN", "FULL"]));
    expect(new Set(schedules.map((schedule) => schedule.city)).size).toBeGreaterThan(5);
  });

  it("menu sesuai struktur yang disepakati", () => {
    expect(content.headerNav.map((item) => [item.label, item.href])).toEqual([
      ["Beranda", "/"],
      ["Profil", "/profil"],
      ["Layanan", "/layanan"],
      ["Pelatihan", "/pelatihan"],
      ["Jadwal Training", "/jadwal"],
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
    expect(JSON.stringify(trainings)).not.toMatch(/\[UJI\]/);
    expect(content.clients.every((name) => name.startsWith("PT Contoh "))).toBe(true);
  });
});
