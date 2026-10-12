// Menulis katalog contoh (seed-data/catalog.ts) ke database: kategori, pelatihan, tautan kategori,
// dan jadwal. Dipakai seed.ts (database kosong) dan sync-content-dev.ts (setelah katalog lama dihapus).
import type { Prisma } from "../../src/generated/prisma/client";
import { appDateString } from "../../src/lib/time";
import { buildSchedules, categories, publishOrder, trainings } from "./catalog";

type CatalogClient = Pick<Prisma.TransactionClient, "category" | "training" | "trainingCategory" | "schedule">;

// Pelatihan terbaru di beranda = publishedAt terbaru; jarak satu jam per pelatihan, sebelum `now`.
const HOUR = 60 * 60 * 1000;

export async function writeCatalog(db: CatalogClient, now: Date = new Date()) {
  const categoryIds = new Map<string, string>();
  for (const [order, category] of categories.entries()) {
    const saved = await db.category.create({ data: { ...category, order }, select: { id: true } });
    categoryIds.set(category.slug, saved.id);
  }

  const order = publishOrder();
  const latest = now.getTime() - HOUR;
  const trainingIds = new Map<string, string>();
  for (const training of trainings) {
    const publishedAt = new Date(latest - (order.length - 1 - order.indexOf(training.slug)) * HOUR);
    const saved = await db.training.create({
      data: {
        slug: training.slug,
        title: training.title,
        summary: training.summary,
        description: training.description as unknown as Prisma.InputJsonValue,
        outcomes: training.outcomes,
        modules: training.modules,
        audience: training.audience,
        prerequisites: training.prerequisites,
        // Tanpa fasilitas khusus: kolom NULL = pakai default global (training.defaults).
        ...(training.facilities ? { facilities: training.facilities } : {}),
        faq: training.faq,
        duration: training.duration,
        method: training.method,
        types: training.types,
        priceText: training.priceText,
        showPrice: training.showPrice,
        status: "PUBLISHED",
        publishedAt,
        publishRevalidatedAt: publishedAt,
      },
      select: { id: true },
    });
    trainingIds.set(training.slug, saved.id);
    await db.trainingCategory.createMany({
      data: training.categorySlugs.map((slug) => {
        const categoryId = categoryIds.get(slug);
        if (!categoryId) throw new Error(`Kategori ${slug} tidak ditemukan`);
        return { trainingId: saved.id, categoryId };
      }),
    });
  }

  const schedules = buildSchedules(appDateString(now));
  await db.schedule.createMany({
    data: schedules.map(({ trainingSlug, startDate, endDate, ...schedule }) => {
      const trainingId = trainingIds.get(trainingSlug);
      if (!trainingId) throw new Error(`Pelatihan ${trainingSlug} untuk jadwal contoh tidak ditemukan`);
      return {
        ...schedule,
        trainingId,
        startDate: new Date(`${startDate}T00:00:00.000Z`),
        endDate: new Date(`${endDate}T00:00:00.000Z`),
      };
    }),
  });

  return { categories: categories.length, trainings: trainings.length, schedules: schedules.length };
}
