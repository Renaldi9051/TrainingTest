import { describe, expect, it } from "vitest";
import type { PublicTrainingDetail } from "@/lib/api/types";
import { courseJsonLd, scheduleEventJsonLd, whatsappTrainingUrl } from "@/lib/structured-data";

const SITE = "https://contoh.id";

const training: PublicTrainingDetail = {
  slug: "kpi",
  title: "Manajemen Kinerja Berbasis KPI",
  summary: "Ringkas",
  duration: "2 hari",
  method: "OFFLINE",
  types: ["PUBLIC"],
  cover: { url: "/uploads/a.webp", alt: "x", width: 10, height: 10, mime: "image/webp", variants: null },
  categories: [{ slug: "sdm", name: "SDM" }],
  publishedAt: "2026-10-01T00:00:00.000Z",
  bodyHtml: null,
  objectivesHtml: null,
  syllabusHtml: null,
  audienceHtml: null,
  facilitiesHtml: null,
  showPrice: false,
  priceText: null,
  seo: { title: "", description: "", ogImage: null },
  schedules: [
    { id: "s1", startDate: "2026-11-17", endDate: "2026-11-18", city: "Jakarta", venue: null, method: "OFFLINE", price: null, status: "OPEN" },
    { id: "s2", startDate: "2026-10-01", endDate: "2026-10-02", city: null, venue: null, method: "ONLINE", price: null, status: "COMPLETED" },
  ],
  related: [],
  updatedAt: "2026-10-01T00:00:00.000Z",
};

describe("courseJsonLd", () => {
  it("Course dengan URL absolut dan sesi yang belum selesai", () => {
    const json = courseJsonLd(training, SITE, "Lembaga");
    expect(json).toMatchObject({
      "@type": "Course",
      name: training.title,
      description: "Ringkas",
      url: "https://contoh.id/pelatihan/kpi",
      image: "https://contoh.id/uploads/a.webp",
      provider: { name: "Lembaga" },
    });
    expect(json.hasCourseInstance).toEqual([
      { "@type": "CourseInstance", courseMode: "Onsite", startDate: "2026-11-17", endDate: "2026-11-18", location: "Jakarta" },
    ]);
  });
});

describe("scheduleEventJsonLd", () => {
  const base = {
    title: "KPI",
    slug: "kpi",
    startDate: "2026-11-17",
    endDate: "2026-11-18",
    city: "Jakarta",
    venue: "Hotel A",
    method: "OFFLINE" as const,
    status: "OPEN" as const,
  };

  it("harga disembunyikan: tanpa offers", () => {
    expect(scheduleEventJsonLd({ ...base, price: null }, SITE, "Lembaga")).not.toHaveProperty("offers");
  });

  it("harga tampil: offers IDR, sesi penuh = SoldOut", () => {
    expect(scheduleEventJsonLd({ ...base, price: 4500000, status: "FULL" }, SITE, "Lembaga").offers).toMatchObject({
      price: 4500000,
      priceCurrency: "IDR",
      availability: "https://schema.org/SoldOut",
    });
  });

  it("online = VirtualLocation", () => {
    expect(scheduleEventJsonLd({ ...base, method: "ONLINE", price: null }, SITE, "L").location).toMatchObject({
      "@type": "VirtualLocation",
    });
  });
});

describe("whatsappTrainingUrl", () => {
  it("pesan otomatis berisi judul pelatihan", () => {
    const url = new URL(whatsappTrainingUrl("6281200000000", "KPI & OKR"));
    expect(url.origin + url.pathname).toBe("https://wa.me/6281200000000");
    expect(url.searchParams.get("text")).toContain('"KPI & OKR"');
  });
});
