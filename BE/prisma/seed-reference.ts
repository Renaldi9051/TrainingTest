// Katalog referensi dan submenu Pelatihan untuk seed standar maupun impor manual.
// Semua pencocokan mencakup baris di Sampah agar penghapusan oleh admin tidak dibatalkan.
import type { Prisma } from "../src/generated/prisma/client";
import { getDb } from "../src/lib/db";
import { pickPrimaryCategory } from "./seed-data/primary-category";
import { loadCategoryCandidates } from "./seed-single-category";
import { categories as demoCategories, trainings as demoTrainings } from "./seed-data/catalog";
import {
  referenceCategories,
  referenceMenuCategories,
  hasReferenceTitle,
  referencePosts,
  referenceSnapshotSlugs,
  referenceTraining,
} from "./seed-data/reference-training";

export const REFERENCE_SEED_KEY = "seed.referenceCatalog.version";
// Naikkan versi ini setiap isi katalog berubah: seed dijalankan lagi sekali untuk database yang markernya lama.
export const REFERENCE_SEED_VERSION = "2026-10-19-adm-6-acc-10";
const batchSize = 100;
const batches = <T>(items: T[], size = batchSize) =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size));

const db = getDb();

export async function seedReferenceCatalog({ hideDemo = false }: { hideDemo?: boolean } = {}) {
  const startedAt = new Date();
  const existingCategories = new Set(
    (await db.category.findMany({
      where: { slug: { in: referenceCategories.map((item) => item.slug) } },
      select: { slug: true },
    })).map((item) => item.slug),
  );
  let categoriesCreated = 0;
  for (const batch of batches(referenceCategories.filter((item) => !existingCategories.has(item.slug)))) {
    categoriesCreated += (await db.category.createMany({ data: batch, skipDuplicates: true })).count;
  }
  for (const category of referenceCategories) {
    await db.category.updateMany({
      where: { slug: category.slug, deletedAt: null, updatedById: null },
      data: { order: category.order, featured: category.featured },
    });
  }
  const categoryIds = new Map(
    (await db.category.findMany({
      where: { slug: { in: referenceCategories.map((item) => item.slug) }, deletedAt: null },
      select: { id: true, slug: true },
    })).map((item) => [item.slug, item.id]),
  );

  const existingTrainings = new Set(
    (await db.training.findMany({
      where: { slug: { in: referencePosts.map((item) => item.slug) } },
      select: { slug: true },
    })).map((item) => item.slug),
  );
  let trainingsCreated = 0;
  // Post tanpa judul dilewati (validator admin juga menolak judul kosong).
  const importable = referencePosts.filter((post) => !existingTrainings.has(post.slug) && hasReferenceTitle(post));
  for (const batch of batches(importable)) {
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
    trainingsCreated += (await db.training.createMany({ data, skipDuplicates: true })).count;
  }

  const trainingIds = new Map(
    (await db.training.findMany({
      where: { slug: { in: referencePosts.map((item) => item.slug) }, deletedAt: null, updatedById: null },
      select: { id: true, slug: true },
    })).map((item) => [item.slug, item.id]),
  );
  // Satu pelatihan satu kategori: dari kategori sumber dipilih satu (seed-data/primary-category.ts).
  const candidates = await loadCategoryCandidates();
  const candidateById = new Map(candidates.map((category) => [category.id, category]));
  const links = referencePosts.flatMap((post) => {
    const trainingId = trainingIds.get(post.slug);
    if (!trainingId) return [];
    const training = referenceTraining(post);
    const current = training.categorySlugs.flatMap((slug) => {
      const category = candidateById.get(categoryIds.get(slug) ?? "");
      return category ? [category] : [];
    });
    const chosen = pickPrimaryCategory(training.title, current, candidates);
    return chosen ? [{ trainingId, categoryId: chosen.id }] : [];
  });
  let linksCreated = 0;
  for (const batch of batches(links, 500)) {
    linksCreated += (await db.trainingCategory.createMany({ data: batch, skipDuplicates: true })).count;
  }

  // Merapikan database yang sudah berisi katalog lengkap versi lama. Hanya baris yang belum disentuh
  // admin (updatedById kosong): pelatihan yang tidak lagi dipilih masuk Sampah, dan tautan kategori yang
  // tidak lagi dipakai dilepas, supaya tiap kategori kembali berisi paling banyak 10 pelatihan.
  const selectedSlugs = new Set(referencePosts.map((post) => post.slug));
  let trainingsHidden = 0;
  for (const batch of batches(referenceSnapshotSlugs.filter((slug) => !selectedSlugs.has(slug)), 500)) {
    trainingsHidden += (
      await db.training.updateMany({
        where: { slug: { in: batch }, deletedAt: null, updatedById: null },
        data: { deletedAt: startedAt },
      })
    ).count;
  }
  const wantedLinks = new Set(links.map((link) => `${link.trainingId}:${link.categoryId}`));
  let linksRemoved = 0;
  for (const batch of batches([...trainingIds.values()], 500)) {
    const existing = await db.trainingCategory.findMany({
      where: { trainingId: { in: batch } },
      select: { trainingId: true, categoryId: true },
    });
    const stale = existing.filter((link) => !wantedLinks.has(`${link.trainingId}:${link.categoryId}`));
    for (const part of batches(stale, 200)) {
      linksRemoved += (await db.trainingCategory.deleteMany({ where: { OR: part } })).count;
    }
  }

  let menu = await db.navItem.findFirst({
    where: { location: "HEADER", href: "/pelatihan", parentId: null, deletedAt: null },
    select: { id: true },
  });
  if (!menu && (await db.navItem.count({ where: { location: "HEADER", href: "/pelatihan", parentId: null } })) === 0) {
    menu = await db.navItem.create({
      data: { location: "HEADER", label: "Pelatihan", href: "/pelatihan", order: 3 },
      select: { id: true },
    });
  }
  let menuCreated = 0;
  if (menu) {
    const existing = await db.navItem.findMany({ where: { parentId: menu.id }, select: { href: true } });
    const hrefs = new Set(existing.map((item) => item.href));
    const desired = referenceMenuCategories.map(({ name, slug }, order) => ({
      location: "HEADER" as const,
      label: name,
      href: `/pelatihan/kategori/${slug}`,
      parentId: menu.id,
      order,
    }));
    menuCreated = (await db.navItem.createMany({
      data: desired.filter((item) => !hrefs.has(item.href)),
    })).count;
    for (const item of desired) {
      await db.navItem.updateMany({
        where: { parentId: menu.id, href: item.href, deletedAt: null, updatedById: null },
        data: { label: item.label, order: item.order },
      });
    }
  }

  if (hideDemo) {
    for (const item of demoTrainings) {
      await db.training.updateMany({
        where: { slug: item.slug, title: item.title, deletedAt: null, updatedById: null },
        data: { deletedAt: startedAt },
      });
    }
    const referenceSlugs = new Set(referenceCategories.map((item) => item.slug));
    for (const item of demoCategories.filter((category) => !referenceSlugs.has(category.slug))) {
      await db.category.updateMany({
        where: { slug: item.slug, name: item.name, deletedAt: null, updatedById: null },
        data: { deletedAt: startedAt },
      });
    }
  }

  await db.siteSetting.upsert({
    where: { key: REFERENCE_SEED_KEY },
    create: { key: REFERENCE_SEED_KEY, value: REFERENCE_SEED_VERSION },
    update: { value: REFERENCE_SEED_VERSION },
  });
  return { categoriesCreated, trainingsCreated, linksCreated, menuCreated, trainingsHidden, linksRemoved };
}
