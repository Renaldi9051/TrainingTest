// Impor snapshot katalog publik ke database lokal secara idempoten. Perubahan admin pada entri
// dengan slug sama tidak ditimpa. Jalankan: npm run db:seed:reference
import type { Prisma } from "../src/generated/prisma/client";
import { getDb } from "../src/lib/db";
import { trainings as demoTrainings, categories as demoCategories } from "../prisma/seed-data/catalog";
import {
  referenceCategories,
  referenceMenuCategories,
  referencePosts,
  referenceTraining,
} from "../prisma/seed-data/reference-training";

const db = getDb();
const batchSize = 100;
const batches = <T>(items: T[], size = batchSize) =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size));

async function main() {
  const startedAt = new Date();
  for (const batch of batches(referenceCategories)) {
    await db.category.createMany({ data: batch, skipDuplicates: true });
  }
  for (const category of referenceCategories) {
    await db.category.updateMany({ where: { slug: category.slug, deletedAt: null, updatedById: null }, data: { order: category.order, featured: category.featured } });
  }
  const categoryIds = new Map(
    (await db.category.findMany({ where: { slug: { in: referenceCategories.map((item) => item.slug) }, deletedAt: null }, select: { id: true, slug: true } }))
      .map((item) => [item.slug, item.id]),
  );
  console.info(`${categoryIds.size} kategori tersedia.`);

  let created = 0;
  for (const [index, batch] of batches(referencePosts).entries()) {
    const data = batch.map((post) => {
      const item = referenceTraining(post);
      return {
        slug: item.slug,
        title: item.title,
        summary: item.summary,
        description: item.description as Prisma.InputJsonValue,
        outcomes: item.outcomes,
        modules: item.modules,
        audience: item.audience,
        facilities: [],
        faq: item.faq,
        duration: null,
        method: null,
        types: ["PUBLIC", "IN_HOUSE"] as ("PUBLIC" | "IN_HOUSE")[],
        priceText: null,
        showPrice: false,
        status: "PUBLISHED" as const,
        publishedAt: item.publishedAt,
        publishRevalidatedAt: item.publishedAt,
      };
    });
    const result = await db.training.createMany({ data, skipDuplicates: true });
    created += result.count;
    if ((index + 1) % 10 === 0) console.info(`Pelatihan: ${Math.min((index + 1) * batchSize, referencePosts.length)}/${referencePosts.length}`);
  }

  const trainingIds = new Map(
    (await db.training.findMany({ where: { slug: { in: referencePosts.map((item) => item.slug) }, deletedAt: null }, select: { id: true, slug: true } }))
      .map((item) => [item.slug, item.id]),
  );
  const links = referencePosts.flatMap((post) => {
    const trainingId = trainingIds.get(post.slug);
    if (!trainingId) return [];
    return referenceTraining(post).categorySlugs.flatMap((slug) => {
      const categoryId = categoryIds.get(slug);
      return categoryId ? [{ trainingId, categoryId }] : [];
    });
  });
  for (const batch of batches(links, 500)) await db.trainingCategory.createMany({ data: batch, skipDuplicates: true });

  const menu = await db.navItem.findFirst({ where: { location: "HEADER", href: "/pelatihan", parentId: null, deletedAt: null }, select: { id: true } });
  if (menu) {
    const existing = await db.navItem.findMany({ where: { parentId: menu.id, deletedAt: null }, select: { href: true } });
    const hrefs = new Set(existing.map((item) => item.href));
    const desired = referenceMenuCategories.map(({ name, slug }, order) => ({ location: "HEADER" as const, label: name, href: `/pelatihan/kategori/${slug}`, parentId: menu.id, order }));
    await db.navItem.createMany({
      data: desired.filter((item) => !hrefs.has(item.href)),
    });
    for (const item of desired) {
      await db.navItem.updateMany({ where: { parentId: menu.id, href: item.href, deletedAt: null, updatedById: null }, data: { label: item.label, order: item.order } });
    }
  }

  if (process.argv.includes("--hide-demo")) {
    // Seeder gambar menandai contoh sebagai diperbarui admin. Cocokkan slug DAN judul asli agar
    // entri yang judulnya sudah diubah pengguna tetap dipertahankan.
    for (const item of demoTrainings) {
      await db.training.updateMany({ where: { slug: item.slug, title: item.title, deletedAt: null }, data: { deletedAt: startedAt } });
    }
    const referenceSlugs = new Set(referenceCategories.map((item) => item.slug));
    for (const item of demoCategories.filter((category) => !referenceSlugs.has(category.slug))) {
      await db.category.updateMany({ where: { slug: item.slug, name: item.name, deletedAt: null }, data: { deletedAt: startedAt } });
    }
  }
  console.info(`Impor selesai: ${created} pelatihan baru, ${links.length} tautan kategori. Entri yang sudah ada dipertahankan.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => db.$disconnect());
