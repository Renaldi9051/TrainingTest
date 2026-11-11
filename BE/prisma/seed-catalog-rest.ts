// Sisa katalog referensi (permintaan pemilik, 11 Nov 2026): semua judul web referensi yang belum ada
// di katalog ditambahkan, sekali per versi (juga saat deploy). Pelatihan yang sudah aktif, termasuk 10
// pelatihan awal tiap kategori, tidak disentuh sama sekali (isi, kategori, sampul tetap).
// - Sumber: snapshot utama (reference-catalog.json) + judul yang terbit sesudahnya
//   (reference-catalog-additions.json, scripts/fetch-reference-additions.mjs). Hanya judul dan kategori;
//   uraian memakai naskah seed sendiri (referenceTraining), isi artikel situs lain tidak disalin.
// - Baris di Sampah yang belum pernah diubah admin dipulihkan; judul yang belum ada dibuat baru. Baris
//   yang dihapus/diubah admin dibiarkan.
// - Judul kembar (lihat titleKey: tanda baca, "&"/"and"/"dan", kata sambung, kata Training/Pelatihan, dan
//   urutan kata diabaikan) dengan pelatihan aktif atau judul lain di daftar ini dilewati.
// - SATU kategori per pelatihan (pickRestCategory: dari judul dulu), hanya kategori yang sudah tampil di publik
//   (punya pelatihan aktif) dan tidak ada di CATEGORY_FILL_SKIP. Judul tanpa kategori yang cocok dilewati.
// - Versi 2 ("judul"): pelatihan yang ditambahkan versi 1 (kategori dari tag sumber) dipindah ke kategori
//   hasil pickRestCategory, kalau belum disentuh admin sesudahnya (audit terakhirnya masih dari seed ini).
import { getDb } from "../src/lib/db";
import { revalidateEntity, withRevalidateBatch } from "../src/lib/revalidate-map";
import { containsWholeWord } from "../src/lib/search";
import { AuditAction, writeAudit } from "../src/services/audit";
import { CLEANUP_MERGES } from "./seed-category-cleanup";
import { CATEGORY_FILL_SKIP, createReferenceTraining, normalizeTitle, restoreIntoCategory } from "./seed-category-fill";
import additions from "./seed-data/reference-catalog-additions.json";
import snapshot from "./seed-data/reference-catalog.json";
import {
  BROAD_CATEGORY_SLUGS,
  type CategoryCandidate,
  GENERIC_CATEGORY_SLUGS,
  PRIORITY_CATEGORY_SLUGS,
  pickPrimaryCategory,
} from "./seed-data/primary-category";
import { hasReferenceTitle, plainTitle, type ReferencePost, referenceSnapshotSlugs } from "./seed-data/reference-training";
import { loadCategoryCandidates } from "./seed-single-category";

export const CATALOG_REST_KEY = "seed.catalogRest.version";
export const CATALOG_REST_VERSION = "2026-11-11-judul";
const SOURCE = "catalog-rest";

export type RestSource = { slug: string; post: ReferencePost; categorySlugs: string[] };
export type RestDbRow = { id: string; slug: string; deletedAt: Date | null; updatedById: string | null };
export type RestCategory = CategoryCandidate & { activeTrainings: number };
export type RestPick = {
  slug: string;
  title: string;
  categoryId: string;
  categorySlug: string;
  categoryName: string;
  post: ReferencePost;
  source: { kind: "restore"; trainingId: string } | { kind: "create" };
};
export type RestPlan = {
  picks: RestPick[];
  skipped: { duplicate: number; noCategory: number; protectedRows: number; untitled: number };
  summary: { slug: string; before: number; after: number }[];
};

const skipSlugs = new Set<string>(Object.values(CATEGORY_FILL_SKIP).flat());

// Kata yang tidak membedakan judul: penghubung (situs referensi menulis "&", "AND", dan "DAN" untuk judul
// yang sama), kata sambung pendek, dan kata Training/Pelatihan di posisi mana pun.
const TITLE_KEY_IGNORED = new Set(["and", "dan", "the", "of", "for", "di", "in", "to", "a", "an", "training", "trainning", "pelatihan"]);

// Kunci judul kembar: kata-kata judul (tanpa tanda baca dan kata di atas) diurutkan, jadi "Fire Prevention
// & Protection System" = "FIRE PREVENTION AND PROTECTION SYSTEM" dan "Management Retail" = "Retail
// Management". Angka tetap dihitung ("Supply Chain Management 4.0" berbeda). "" = judul kosong.
export function titleKey(title: string): string {
  return normalizeTitle(title)
    .split(" ")
    .filter((word) => word && !TITLE_KEY_IGNORED.has(word))
    .sort()
    .join(" ");
}
const mergedInto = new Map(CLEANUP_MERGES.map((merge) => [merge.from, merge.to]));

// Slug aplikasi maks 120 karakter (sama seperti withUniqueSlugs di reference-training).
const appSlug = (slug: string) => slug.slice(0, 120).replace(/-+$/g, "");

// Semua judul sumber dengan slug aplikasi yang unik dan slug kategori sumbernya (sudah dipetakan ke
// kategori hasil penggabungan).
export function loadRestSources(): RestSource[] {
  const categorySlugById = new Map(
    [...snapshot.categories, ...additions.categories].map((category) => [category.id, category.slug]),
  );
  const toSlugs = (post: { categoryIds: number[] }) => [
    ...new Set(
      post.categoryIds.flatMap((id) => {
        const slug = categorySlugById.get(id);
        return slug ? [mergedInto.get(slug) ?? slug] : [];
      }),
    ),
  ];
  const fromSnapshot = snapshot.posts.map((post, index) => ({
    slug: referenceSnapshotSlugs[index],
    post,
    categorySlugs: toSlugs(post),
  }));
  const used = new Set(fromSnapshot.map((item) => item.slug));
  const fromAdditions = additions.posts.flatMap((post) => {
    const slug = appSlug(post.slug);
    if (!slug || used.has(slug)) return [];
    used.add(slug);
    return [{ slug, post, categorySlugs: toSlugs(post) }];
  });
  return [...fromSnapshot, ...fromAdditions];
}

// Istilah terpanjang (nama atau kata kunci kategori) yang ada di judul; 0 = tidak cocok.
function titleMatchLength(title: string, category: CategoryCandidate): number {
  return [category.name, ...category.keywords]
    .filter((term) => term.trim() && containsWholeWord(title, term))
    .reduce((longest, term) => Math.max(longest, term.trim().length), 0);
}

const tierOf = (slug: string) => (GENERIC_CATEGORY_SLUGS.has(slug) ? 2 : BROAD_CATEGORY_SLUGS.has(slug) ? 1 : 0);

// Kategori satu kata umum: kata ini muncul di banyak judul lintas topik ("Talent Management",
// "HSE Management System", "Job Safety Analysis"), jadi kecocokan judulnya tidak dianggap cukup
// spesifik untuk mengalahkan tag sumber. Judul yang hanya cocok dengan kategori ini memakai aturan lama.
export const WEAK_TITLE_CATEGORY_SLUGS = new Set(["management", "control", "analysis", "development", "design", "corporate", "digital"]);

// Kategori dari JUDUL dulu (versi 2, pemilik 11 Nov 2026): tag kategori web referensi sering tidak tepat
// (mis. "Customer Service Fundamentals" bertag accounting). Di antara kategori yang nama/kata kuncinya ada
// di judul: kategori bertopik sebelum tag luas, prioritas drone/pemetaan, istilah cocok terpanjang (paling
// spesifik), kategori yang juga ditandai sumber, kategori yang lebih sedikit isinya, lalu slug.
// Tidak ada yang cocok dari judul: aturan lama (pickPrimaryCategory dari tag sumber).
export function pickRestCategory(title: string, current: readonly RestCategory[], visible: readonly RestCategory[]): RestCategory | null {
  const currentIds = new Set(current.map((category) => category.id));
  const matches = visible
    .filter((category) => tierOf(category.slug) < 2 && !WEAK_TITLE_CATEGORY_SLUGS.has(category.slug))
    .map((category) => ({ category, length: titleMatchLength(title, category) }))
    .filter((match) => match.length > 0);
  if (matches.length === 0) return pickPrimaryCategory(title, current, visible);
  const priority = (slug: string) => {
    const index = PRIORITY_CATEGORY_SLUGS.indexOf(slug);
    return index === -1 ? PRIORITY_CATEGORY_SLUGS.length : index;
  };
  matches.sort(
    (a, b) =>
      tierOf(a.category.slug) - tierOf(b.category.slug) ||
      priority(a.category.slug) - priority(b.category.slug) ||
      b.length - a.length ||
      Number(currentIds.has(b.category.id)) - Number(currentIds.has(a.category.id)) ||
      a.category.activeTrainings - b.category.activeTrainings ||
      a.category.slug.localeCompare(b.category.slug),
  );
  return matches[0].category;
}

export const visibleCategories = (categories: RestCategory[]) =>
  categories.filter((category) => category.activeTrainings > 0 && !skipSlugs.has(category.slug));

// Rencana murni (tanpa database). Kategori tujuan hanya yang tampil (activeTrainings > 0) dan tidak di
// CATEGORY_FILL_SKIP. Urutan: baris yang bisa dipulihkan dulu (sudah punya isi & foto), lalu terbaru.
export function planCatalogRest(input: {
  sources: RestSource[];
  categories: RestCategory[];
  activeTitles: string[];
  dbRows: RestDbRow[];
}): RestPlan {
  const visible = visibleCategories(input.categories);
  const visibleBySlug = new Map(visible.map((category) => [category.slug, category]));
  const rowBySlug = new Map(input.dbRows.map((row) => [row.slug, row]));
  const usedTitles = new Set(input.activeTitles.map(titleKey));
  const skipped = { duplicate: 0, noCategory: 0, protectedRows: 0, untitled: 0 };

  const candidates = input.sources.flatMap((source) => {
    if (!hasReferenceTitle(source.post)) {
      skipped.untitled += 1;
      return [];
    }
    const row = rowBySlug.get(source.slug);
    if (row?.deletedAt === null) return []; // sudah aktif: tidak disentuh
    if (row && row.updatedById !== null) {
      skipped.protectedRows += 1; // dihapus atau diubah admin
      return [];
    }
    return [{ ...source, title: plainTitle(source.post.title).slice(0, 200), restoreId: row?.id ?? null }];
  });
  candidates.sort(
    (a, b) =>
      Number(b.restoreId !== null) - Number(a.restoreId !== null) ||
      b.post.date.localeCompare(a.post.date) ||
      a.slug.localeCompare(b.slug),
  );

  const picks: RestPick[] = [];
  for (const candidate of candidates) {
    const key = titleKey(candidate.title);
    if (!key || usedTitles.has(key)) {
      skipped.duplicate += 1;
      continue;
    }
    const current = candidate.categorySlugs.flatMap((slug) => visibleBySlug.get(slug) ?? []);
    const chosen = pickRestCategory(candidate.title, current, visible);
    if (!chosen) {
      skipped.noCategory += 1;
      continue;
    }
    usedTitles.add(key);
    picks.push({
      slug: candidate.slug,
      title: candidate.title,
      categoryId: chosen.id,
      categorySlug: chosen.slug,
      categoryName: chosen.name,
      post: candidate.post,
      source: candidate.restoreId ? { kind: "restore", trainingId: candidate.restoreId } : { kind: "create" },
    });
  }

  const added = new Map<string, number>();
  for (const pick of picks) added.set(pick.categorySlug, (added.get(pick.categorySlug) ?? 0) + 1);
  const summary = visible
    .filter((category) => added.has(category.slug))
    .map((category) => ({
      slug: category.slug,
      before: category.activeTrainings,
      after: category.activeTrainings + (added.get(category.slug) ?? 0),
    }))
    .sort((a, b) => a.slug.localeCompare(b.slug));
  return { picks, skipped, summary };
}

export type RestTrainingRow = { id: string; slug: string; title: string; categoryIds: string[]; untouched: boolean };
export type RestMove = { trainingId: string; slug: string; fromIds: string[]; to: RestCategory };
export type RestAudit = { action: string; diff: unknown };

const auditSource = (diff: unknown): string | null =>
  diff !== null && typeof diff === "object" && "source" in diff && typeof diff.source === "string" ? diff.source : null;
// Seed foto (theme gallery, training photos) hanya mengisi sampul & galeri; itu bukan suntingan admin
// yang perlu dijaga untuk urusan kategori.
const PHOTO_ONLY_KEYS = new Set(["coverId", "imageIds"]);
const photoOnly = (audit: RestAudit) =>
  audit.action === AuditAction.UPDATE &&
  audit.diff !== null &&
  typeof audit.diff === "object" &&
  Object.keys(audit.diff).every((key) => PHOTO_ONLY_KEYS.has(key));

// audits: urut lama -> baru. Belum disentuh = ada entri seed ini, dan semua entri sesudahnya juga dari
// seed ini atau hanya mengisi sampul/galeri.
export function untouchedSinceSeed(audits: RestAudit[]): boolean {
  const first = audits.findIndex((audit) => auditSource(audit.diff)?.startsWith(SOURCE));
  if (first === -1) return false;
  return audits.slice(first + 1).every((audit) => auditSource(audit.diff)?.startsWith(SOURCE) || photoOnly(audit));
}

// Versi 2: pindahkan pelatihan hasil seed ini ke kategori dari judul (murni, tanpa database). Hanya baris
// yang belum disentuh admin sejak seed ini (untouchedSinceSeed) dan sumbernya dikenal.
export function planRecategorize(input: {
  rows: RestTrainingRow[];
  sources: RestSource[];
  categories: RestCategory[];
}): RestMove[] {
  const visible = visibleCategories(input.categories);
  const visibleBySlug = new Map(visible.map((category) => [category.slug, category]));
  const sourceBySlug = new Map(input.sources.map((source) => [source.slug, source]));
  return input.rows.flatMap((row) => {
    if (!row.untouched) return [];
    const source = sourceBySlug.get(row.slug);
    if (!source) return [];
    const current = source.categorySlugs.flatMap((slug) => visibleBySlug.get(slug) ?? []);
    const chosen = pickRestCategory(row.title, current, visible);
    if (!chosen || (row.categoryIds.length === 1 && row.categoryIds[0] === chosen.id)) return [];
    return [{ trainingId: row.id, slug: row.slug, fromIds: row.categoryIds, to: chosen }];
  });
}

// Perubahan jumlah pelatihan aktif per kategori akibat pemindahan.
export function moveSummary(moves: RestMove[], categories: RestCategory[]): RestPlan["summary"] {
  const delta = new Map<string, number>();
  for (const move of moves) {
    for (const id of move.fromIds) delta.set(id, (delta.get(id) ?? 0) - 1);
    delta.set(move.to.id, (delta.get(move.to.id) ?? 0) + 1);
  }
  return categories
    .filter((category) => (delta.get(category.id) ?? 0) !== 0)
    .map((category) => ({
      slug: category.slug,
      before: category.activeTrainings,
      after: category.activeTrainings + (delta.get(category.id) ?? 0),
    }))
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

const db = getDb();

export async function loadRestCategories(): Promise<RestCategory[]> {
  const [candidates, counts] = await Promise.all([
    loadCategoryCandidates(),
    db.category.findMany({
      where: { deletedAt: null },
      select: { id: true, _count: { select: { trainings: { where: { training: { deletedAt: null } } } } } },
    }),
  ]);
  const countById = new Map(counts.map((category) => [category.id, category._count.trainings]));
  return candidates.map((category) => ({ ...category, activeTrainings: countById.get(category.id) ?? 0 }));
}

// Rencana pemindahan dari database (versi 2).
export async function loadRecategorizePlan(): Promise<{ moves: RestMove[]; summary: RestPlan["summary"] }> {
  const logs = await db.auditLog.findMany({
    where: { entity: "Training", diff: { path: ["source"], string_starts_with: SOURCE } },
    select: { entityId: true },
  });
  const ids = [...new Set(logs.flatMap((log) => (log.entityId ? [log.entityId] : [])))];
  if (ids.length === 0) return { moves: [], summary: [] };
  const [trainings, audits, categories] = await Promise.all([
    db.training.findMany({
      where: { id: { in: ids }, deletedAt: null },
      select: { id: true, slug: true, title: true, categories: { select: { categoryId: true } } },
    }),
    db.auditLog.findMany({
      where: { entity: "Training", entityId: { in: ids } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { entityId: true, action: true, diff: true },
    }),
    loadRestCategories(),
  ]);
  const history = new Map<string, RestAudit[]>();
  for (const audit of audits) {
    if (!audit.entityId) continue;
    history.set(audit.entityId, [...(history.get(audit.entityId) ?? []), { action: audit.action, diff: audit.diff }]);
  }
  const moves = planRecategorize({
    rows: trainings.map((training) => ({
      id: training.id,
      slug: training.slug,
      title: training.title,
      categoryIds: training.categories.map((link) => link.categoryId),
      untouched: untouchedSinceSeed(history.get(training.id) ?? []),
    })),
    sources: loadRestSources(),
    categories,
  });
  return { moves, summary: moveSummary(moves, categories) };
}

// Rencana penambahan dari database (dipakai seed dan pratinjau `npm run db:seed:catalog-rest -- --dry-run`).
export async function loadCatalogRestPlan(): Promise<RestPlan> {
  const sources = loadRestSources();
  const [categories, active, dbRows] = await Promise.all([
    loadRestCategories(),
    db.training.findMany({ where: { deletedAt: null }, select: { title: true } }),
    db.training.findMany({
      where: { slug: { in: sources.map((source) => source.slug) } },
      select: { id: true, slug: true, deletedAt: true, updatedById: true },
      // Slug hanya unik di antara baris aktif: baris aktif dulu, lalu Sampah terbaru.
      orderBy: [{ deletedAt: { sort: "desc", nulls: "first" } }],
    }),
  ]);
  const firstRowBySlug = new Map<string, RestDbRow>();
  for (const row of dbRows) if (!firstRowBySlug.has(row.slug)) firstRowBySlug.set(row.slug, row);
  return planCatalogRest({
    sources,
    categories,
    activeTitles: active.map((row) => row.title),
    dbRows: [...firstRowBySlug.values()],
  });
}

async function moveTraining(move: RestMove, ownerId: string) {
  await db.$transaction(async (tx) => {
    await tx.trainingCategory.deleteMany({ where: { trainingId: move.trainingId } });
    await tx.trainingCategory.create({ data: { trainingId: move.trainingId, categoryId: move.to.id, isPrimary: true } });
    await writeAudit(
      {
        userId: ownerId,
        action: AuditAction.UPDATE,
        entity: "Training",
        entityId: move.trainingId,
        diff: { categoryIds: { from: move.fromIds, to: [move.to.id] }, source: `${SOURCE}-judul` },
      },
      tx,
    );
  });
  await revalidateEntity({ entity: "Training", slugs: [move.slug] });
}

const emptyPlan = (): RestPlan => ({ picks: [], skipped: { duplicate: 0, noCategory: 0, protectedRows: 0, untitled: 0 }, summary: [] });

export type CatalogRestResult = {
  moved: number;
  moveSummary: RestPlan["summary"];
  restored: number;
  created: number;
  skipped: RestPlan["skipped"];
  summary: RestPlan["summary"];
  failed: string[];
};

export async function seedCatalogRest(): Promise<CatalogRestResult | "dilewati"> {
  const done = await db.siteSetting.findUnique({ where: { key: CATALOG_REST_KEY }, select: { value: true } });
  if (done?.value === CATALOG_REST_VERSION) return "dilewati";
  const owner = await db.user.findFirstOrThrow({ orderBy: { createdAt: "asc" }, select: { id: true } });
  const failed: string[] = [];
  let moved = 0;
  let restored = 0;
  let created = 0;
  // Pindahkan dulu hasil versi lama, lalu tambahkan judul yang belum ada (database baru: hanya langkah kedua).
  const recategorize = await loadRecategorizePlan();
  let plan = emptyPlan();

  await withRevalidateBatch(async () => {
    for (const move of recategorize.moves) {
      try {
        await moveTraining(move, owner.id);
        moved += 1;
      } catch (error) {
        failed.push(`${move.slug} (${error instanceof Error ? error.message : String(error)})`);
      }
    }
    plan = await loadCatalogRestPlan();
    for (const pick of plan.picks) {
      try {
        if (pick.source.kind === "restore") {
          await restoreIntoCategory({ trainingId: pick.source.trainingId, categoryId: pick.categoryId, ownerId: owner.id, source: SOURCE });
          restored += 1;
        } else {
          await createReferenceTraining({
            post: pick.post,
            slug: pick.slug,
            categoryId: pick.categoryId,
            categoryName: pick.categoryName,
            ownerId: owner.id,
            source: SOURCE,
          });
          created += 1;
        }
      } catch (error) {
        failed.push(`${pick.slug} (${error instanceof Error ? error.message : String(error)})`);
      }
    }
  });

  await db.siteSetting.upsert({
    where: { key: CATALOG_REST_KEY },
    create: { key: CATALOG_REST_KEY, value: CATALOG_REST_VERSION },
    update: { value: CATALOG_REST_VERSION },
  });
  return {
    moved,
    moveSummary: recategorize.summary,
    restored,
    created,
    skipped: plan.skipped,
    summary: plan.summary,
    failed,
  };
}

// Ringkasan untuk log seed dan skrip.
export function describeCatalogRest(result: CatalogRestResult | "dilewati" | null): string {
  if (result === "dilewati" || result === null) return "Sisa katalog referensi: dilewati (versi ini sudah dijalankan).";
  const { skipped } = result;
  const counts = (items: RestPlan["summary"]) => items.map((item) => `${item.slug} ${item.before}->${item.after}`).join(", ");
  return (
    `Sisa katalog referensi: ${result.moved} dipindah ke kategori dari judul` +
    (result.moved > 0 ? ` (${counts(result.moveSummary)})` : "") +
    `; ${result.restored} dipulihkan dari Sampah, ${result.created} dibuat; dilewati ` +
    `${skipped.duplicate} judul kembar, ${skipped.noCategory} tanpa kategori, ${skipped.protectedRows} dihapus/diubah admin, ` +
    `${skipped.untitled} tanpa judul` +
    (result.summary.length > 0 ? ` (${counts(result.summary)})` : "") +
    (result.failed.length > 0 ? `; gagal: ${result.failed.join("; ")}.` : ".")
  );
}
