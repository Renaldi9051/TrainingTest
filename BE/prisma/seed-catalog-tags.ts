// Kategori tambahan dari situs referensi (pemilik, 11 Nov 2026): satu pelatihan boleh tampil di beberapa
// kategori, seperti diotraining. Tiap pelatihan aktif yang judulnya ada di snapshot referensi ditautkan
// ke kategori-kategori sumbernya sebagai kategori TAMBAHAN (isPrimary false). Kategori utama (label
// kartu) tidak berubah.
// - Hanya kategori yang sudah tampil di publik dan tidak di CATEGORY_FILL_SKIP (kembar/typo/umum).
// - Hanya menambah tautan; tautan yang ada tidak dihapus/diubah.
// - Pelatihan yang kategorinya pernah diubah admin (edit, aksi massal, pindah lewat kata kunci) dilewati.
// - Sekali per versi (SiteSetting), ikut `prisma db seed` saat deploy.
import { getDb } from "../src/lib/db";
import { revalidateEntity, withRevalidateBatch } from "../src/lib/revalidate-map";
import { AuditAction, writeAudit } from "../src/services/audit";
import { loadRestCategories, loadRestSources, type RestCategory, type RestSource, visibleCategories } from "./seed-catalog-rest";
import { normalizeTitle } from "./seed-category-fill";
import { plainTitle } from "./seed-data/reference-training";

export const CATALOG_TAGS_KEY = "seed.catalogTags.version";
export const CATALOG_TAGS_VERSION = "2026-11-11";
const SOURCE = "catalog-tags";
const BATCH = 200;

export type TagTraining = { id: string; slug: string; title: string; categoryIds: string[]; adminChanged: boolean };
export type TagAdd = { trainingId: string; slug: string; fromIds: string[]; addIds: string[] };
export type TagPlan = {
  adds: TagAdd[];
  skipped: { noSource: number; adminChanged: number };
  summary: { slug: string; before: number; after: number }[];
};

// Rencana murni (tanpa database). Sumber dicocokkan lewat slug, lalu judul yang dinormalkan.
export function planCatalogTags(input: {
  sources: RestSource[];
  categories: RestCategory[];
  trainings: TagTraining[];
}): TagPlan {
  const visible = visibleCategories(input.categories);
  const visibleBySlug = new Map(visible.map((category) => [category.slug, category]));
  const bySlug = new Map(input.sources.map((source) => [source.slug, source]));
  const byTitle = new Map<string, Set<string>>();
  for (const source of input.sources) {
    const key = normalizeTitle(plainTitle(source.post.title));
    if (!key) continue;
    const set = byTitle.get(key) ?? new Set<string>();
    for (const slug of source.categorySlugs) set.add(slug);
    byTitle.set(key, set);
  }

  const adds: TagAdd[] = [];
  const skipped = { noSource: 0, adminChanged: 0 };
  const added = new Map<string, number>();
  for (const training of input.trainings) {
    const sourceSlugs = bySlug.get(training.slug)?.categorySlugs ?? [...(byTitle.get(normalizeTitle(training.title)) ?? [])];
    if (sourceSlugs.length === 0) {
      skipped.noSource += 1;
      continue;
    }
    const linked = new Set(training.categoryIds);
    const addIds = [
      ...new Set(sourceSlugs.flatMap((slug) => visibleBySlug.get(slug)?.id ?? []).filter((id) => !linked.has(id))),
    ];
    if (addIds.length === 0) continue;
    if (training.adminChanged) {
      skipped.adminChanged += 1;
      continue;
    }
    adds.push({ trainingId: training.id, slug: training.slug, fromIds: training.categoryIds, addIds });
    for (const id of addIds) added.set(id, (added.get(id) ?? 0) + 1);
  }
  const summary = visible
    .filter((category) => added.has(category.id))
    .map((category) => ({
      slug: category.slug,
      before: category.activeTrainings,
      after: category.activeTrainings + (added.get(category.id) ?? 0),
    }))
    .sort((a, b) => a.slug.localeCompare(b.slug));
  return { adds, skipped, summary };
}

const db = getDb();

// Pelatihan yang kategorinya pernah diputuskan admin: edit dengan categoryIds tanpa penanda seed, aksi
// massal "ganti kategori", atau dipindah lewat kata kunci kategori.
async function loadAdminChangedIds(): Promise<Set<string>> {
  const [edits, bulks, moves] = await Promise.all([
    db.$queryRaw<{ entityId: string | null; diff: unknown }[]>`
      SELECT "entityId", "diff" FROM "AuditLog"
      WHERE "entity" = 'Training' AND "action" = 'UPDATE' AND "diff" ? 'categoryIds'`,
    db.auditLog.findMany({
      where: { entity: "Training", action: AuditAction.BULK, diff: { path: ["action"], equals: "set-category" } },
      select: { diff: true },
    }),
    db.auditLog.findMany({
      where: { entity: "Category", diff: { path: ["source"], equals: "keywords" } },
      select: { diff: true },
    }),
  ]);
  const ids = new Set<string>();
  const record = (value: unknown) => (typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {});
  const list = (value: unknown) => (Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []);
  for (const edit of edits) {
    const diff = record(edit.diff);
    if (edit.entityId && diff.categoryIds !== undefined && diff.source === undefined) ids.add(edit.entityId);
  }
  for (const bulk of bulks) for (const id of list(record(bulk.diff).ids)) ids.add(id);
  for (const move of moves) for (const id of list(record(move.diff).movedTrainings)) ids.add(id);
  return ids;
}

export async function loadCatalogTagsPlan(): Promise<TagPlan> {
  const [categories, rows, adminChanged] = await Promise.all([
    loadRestCategories(),
    db.training.findMany({
      where: { deletedAt: null },
      select: { id: true, slug: true, title: true, categories: { select: { categoryId: true } } },
      orderBy: { slug: "asc" },
    }),
    loadAdminChangedIds(),
  ]);
  return planCatalogTags({
    sources: loadRestSources(),
    categories,
    trainings: rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      categoryIds: row.categories.map((link) => link.categoryId),
      adminChanged: adminChanged.has(row.id),
    })),
  });
}

export type CatalogTagsResult = { trainings: number; links: number; skipped: TagPlan["skipped"]; summary: TagPlan["summary"]; failed: string[] };

export async function seedCatalogTags(): Promise<CatalogTagsResult | "dilewati"> {
  const done = await db.siteSetting.findUnique({ where: { key: CATALOG_TAGS_KEY }, select: { value: true } });
  if (done?.value === CATALOG_TAGS_VERSION) return "dilewati";
  const owner = await db.user.findFirstOrThrow({ orderBy: { createdAt: "asc" }, select: { id: true } });
  const plan = await loadCatalogTagsPlan();
  const failed: string[] = [];
  let trainings = 0;
  let links = 0;

  await withRevalidateBatch(async () => {
    for (let index = 0; index < plan.adds.length; index += BATCH) {
      const batch = plan.adds.slice(index, index + BATCH);
      try {
        await db.$transaction(async (tx) => {
          const result = await tx.trainingCategory.createMany({
            data: batch.flatMap((add) => add.addIds.map((categoryId) => ({ trainingId: add.trainingId, categoryId, isPrimary: false }))),
            skipDuplicates: true,
          });
          links += result.count;
          for (const add of batch) {
            await writeAudit(
              {
                userId: owner.id,
                action: AuditAction.UPDATE,
                entity: "Training",
                entityId: add.trainingId,
                diff: { categoryIds: { from: add.fromIds, to: [...add.fromIds, ...add.addIds] }, source: SOURCE },
              },
              tx,
            );
          }
        });
        trainings += batch.length;
        await revalidateEntity({ entity: "Training", slugs: batch.map((add) => add.slug) });
      } catch (error) {
        failed.push(`${batch[0].slug}.. (${error instanceof Error ? error.message : String(error)})`);
      }
    }
  });

  if (failed.length === 0) {
    await db.siteSetting.upsert({
      where: { key: CATALOG_TAGS_KEY },
      create: { key: CATALOG_TAGS_KEY, value: CATALOG_TAGS_VERSION },
      update: { value: CATALOG_TAGS_VERSION },
    });
  }
  return { trainings, links, skipped: plan.skipped, summary: plan.summary, failed };
}

export function describeCatalogTags(result: CatalogTagsResult | "dilewati" | null): string {
  if (result === null) return "Kategori tambahan referensi: tidak dijalankan.";
  if (result === "dilewati") return `Kategori tambahan referensi: sudah versi ${CATALOG_TAGS_VERSION}, dilewati.`;
  const failed = result.failed.length > 0 ? ` GAGAL ${result.failed.length} batch: ${result.failed.join("; ")}` : "";
  return (
    `Kategori tambahan referensi: ${result.links} tautan baru di ${result.trainings} pelatihan, ` +
    `${result.summary.length} kategori bertambah; dilewati ${result.skipped.noSource} tanpa sumber, ` +
    `${result.skipped.adminChanged} kategorinya diubah admin.${failed}`
  );
}

// Pelatihan tanpa kategori utama (database baru dari seed lama yang menulis tautan tanpa penanda):
// kategori aktif dengan urutan admin terendah jadi utama, sama seperti migrasi training_category_primary.
// Aman dijalankan berulang; pelatihan yang sudah punya kategori utama tidak disentuh.
export async function ensurePrimaryCategories(): Promise<number> {
  return db.$executeRaw`
    UPDATE "TrainingCategory" tc SET "isPrimary" = true
    FROM (
      SELECT DISTINCT ON (l."trainingId") l."trainingId", l."categoryId"
      FROM "TrainingCategory" l
      JOIN "Category" c ON c."id" = l."categoryId"
      WHERE NOT EXISTS (
        SELECT 1 FROM "TrainingCategory" p WHERE p."trainingId" = l."trainingId" AND p."isPrimary"
      )
      ORDER BY l."trainingId", (c."deletedAt" IS NOT NULL), c."order", c."slug"
    ) pick
    WHERE tc."trainingId" = pick."trainingId" AND tc."categoryId" = pick."categoryId"`;
}
