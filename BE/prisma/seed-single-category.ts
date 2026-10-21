// Satu pelatihan satu kategori (keputusan pemilik, 21 Okt 2026), sekali per versi:
// 1. setiap pelatihan (belum dihapus) dengan lebih dari satu kategori aktif, atau yang hanya punya
//    kategori generik, disisakan satu kategori (seed-data/primary-category.ts); tautan lain dilepas;
// 2. kategori generik yang jadi kosong dipindah ke Sampah (service hapus admin, menu ikut dihapus).
// Berlaku untuk semua pelatihan, termasuk yang pernah diubah admin, karena ini aturan data baru
// (validator admin juga hanya menerima satu kategori). Pelatihan yang berubah ditandai diubah admin
// supaya seed katalog referensi berikutnya tidak menambah kategorinya lagi. Kategori yang kosong
// disembunyikan dari publik oleh BE, datanya tetap ada di admin.
// Pelatihan di manifest foto (seed-data/gallery/manifest.json, pilihan pemilik 19 Okt 2026) tetap di
// kategori manifest (accounting), sesuai fotonya.
// v2: seed foto manifest sempat menautkan ulang 3 pelatihan manifest ke accounting setelah v1.
import { getDb } from "../src/lib/db";
import { HttpError } from "../src/lib/http";
import { withRevalidateBatch } from "../src/lib/revalidate-map";
import { AuditAction, writeAudit } from "../src/services/audit";
import { deleteCategory } from "../src/services/category";
import { navCategorySlug } from "../src/services/nav";
import { loadManifestPins } from "./seed-manifest-gallery";
import { type CategoryCandidate, GENERIC_CATEGORY_SLUGS, pickPrimaryCategory } from "./seed-data/primary-category";

export const SINGLE_CATEGORY_KEY = "seed.singleCategory.version";
export const SINGLE_CATEGORY_VERSION = "2026-10-21-one-category-v2";

// Kategori generik yang dihapus kalau sudah kosong (yang lain sudah dihapus seed perapian kategori).
export const EMPTY_GENERIC_TO_DELETE = ["slider", "uncategorized"];

export type SingleCategoryResult = {
  trainingsChanged: number;
  linksRemoved: number;
  linksAdded: number;
  stillGeneric: string[];
  deletedCategories: string[];
  skipped: string[];
};

const db = getDb();
const BATCH = 200;

export async function loadCategoryCandidates(): Promise<CategoryCandidate[]> {
  const [categories, nav] = await Promise.all([
    db.category.findMany({
      where: { deletedAt: null },
      select: { id: true, slug: true, name: true, keywords: true, order: true },
    }),
    db.navItem.findMany({ where: { deletedAt: null, location: "HEADER" }, select: { href: true } }),
  ]);
  const menu = new Set(nav.flatMap((item) => navCategorySlug(item.href) ?? []));
  return categories.map((category) => ({ ...category, inMenu: menu.has(category.slug) }));
}

export type SingleCategoryChange = { trainingId: string; title: string; keep: string; remove: string[]; add: boolean };

// Rencana tanpa menulis apa pun (dipakai seed dan pratinjau): pelatihan yang kategorinya berubah,
// plus pelatihan yang tetap di kategori generik karena judulnya tidak menunjuk kategori bertopik.
export async function planSingleCategory(): Promise<{
  candidates: CategoryCandidate[];
  changes: SingleCategoryChange[];
  stillGeneric: string[];
}> {
  const [candidates, pins] = await Promise.all([loadCategoryCandidates(), loadManifestPins()]);
  const byId = new Map(candidates.map((category) => [category.id, category]));
  const bySlug = new Map(candidates.map((category) => [category.slug, category]));
  const trainings = await db.training.findMany({
    where: { deletedAt: null },
    select: { id: true, slug: true, title: true, categories: { select: { categoryId: true } } },
    orderBy: { slug: "asc" },
  });
  const changes: SingleCategoryChange[] = [];
  const stillGeneric: string[] = [];
  for (const training of trainings) {
    const linkedIds = training.categories.map((link) => link.categoryId);
    const current = linkedIds.flatMap((id) => byId.get(id) ?? []);
    const onlyGeneric = current.length > 0 && current.every((category) => GENERIC_CATEGORY_SLUGS.has(category.slug));
    const pinned = bySlug.get(pins.get(training.slug) ?? "");
    const settled = current.length <= 1 && !onlyGeneric && linkedIds.length === current.length;
    if (settled && (!pinned || current[0]?.id === pinned.id)) continue;
    const chosen = pinned ?? pickPrimaryCategory(training.title, current, candidates);
    if (!chosen) continue;
    if (GENERIC_CATEGORY_SLUGS.has(chosen.slug)) stillGeneric.push(`${training.title} (${chosen.name})`);
    const remove = linkedIds.filter((id) => id !== chosen.id);
    const add = !linkedIds.includes(chosen.id);
    if (remove.length === 0 && !add) continue;
    changes.push({ trainingId: training.id, title: training.title, keep: chosen.id, remove, add });
  }
  return { candidates, changes, stillGeneric };
}

export async function seedSingleCategory(): Promise<SingleCategoryResult | "dilewati"> {
  const done = await db.siteSetting.findUnique({ where: { key: SINGLE_CATEGORY_KEY }, select: { value: true } });
  if (done?.value === SINGLE_CATEGORY_VERSION) return "dilewati";
  const owner = await db.user.findFirstOrThrow({ orderBy: { createdAt: "asc" }, select: { id: true } });
  const { changes, stillGeneric } = await planSingleCategory();
  const result: SingleCategoryResult = {
    trainingsChanged: 0,
    linksRemoved: 0,
    linksAdded: 0,
    stillGeneric,
    deletedCategories: [],
    skipped: [],
  };

  for (let index = 0; index < changes.length; index += BATCH) {
    const batch = changes.slice(index, index + BATCH);
    await db.$transaction(async (tx) => {
      for (const change of batch) {
        if (change.remove.length > 0) {
          result.linksRemoved += (
            await tx.trainingCategory.deleteMany({
              where: { trainingId: change.trainingId, categoryId: { in: change.remove } },
            })
          ).count;
        }
        if (change.add) {
          await tx.trainingCategory.create({ data: { trainingId: change.trainingId, categoryId: change.keep } });
          result.linksAdded += 1;
        }
      }
      const ids = batch.map((change) => change.trainingId);
      await tx.training.updateMany({ where: { id: { in: ids } }, data: { updatedById: owner.id } });
      await writeAudit(
        {
          userId: owner.id,
          action: AuditAction.BULK,
          entity: "Training",
          diff: {
            action: "single-category",
            changes: batch.map(({ trainingId, keep, remove }) => ({ id: trainingId, keep, remove })),
          },
        },
        tx,
      );
    });
  }
  result.trainingsChanged = changes.length;

  await withRevalidateBatch(async () => {
    for (const slug of EMPTY_GENERIC_TO_DELETE) {
      const category = await db.category.findFirst({ where: { slug, deletedAt: null }, select: { id: true, name: true } });
      if (!category) continue;
      try {
        await deleteCategory(category.id, owner.id);
        result.deletedCategories.push(category.name);
      } catch (error) {
        if (!(error instanceof HttpError) || error.code !== "CATEGORY_IN_USE") throw error;
        result.skipped.push(`hapus ${slug} (${error.message})`);
      }
    }
  });

  await db.siteSetting.upsert({
    where: { key: SINGLE_CATEGORY_KEY },
    create: { key: SINGLE_CATEGORY_KEY, value: SINGLE_CATEGORY_VERSION },
    update: { value: SINGLE_CATEGORY_VERSION },
  });
  return result;
}
