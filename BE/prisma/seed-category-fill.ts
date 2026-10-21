// Mengisi kategori sampai 10 pelatihan (permintaan pemilik, 21 Okt 2026), sekali per versi. Sumbernya
// judul web referensi yang sudah ada di database tapi dipindah ke Sampah oleh batas 10 pelatihan per
// kategori versi lama: dipulihkan lewat service admin (slug, redirect, audit) lalu diberi SATU kategori,
// yaitu kategori yang diisi. Uraian pelatihan tetap naskah seed sendiri (tidak menyalin isi situs lain).
// - Kandidat: artikel snapshot yang ditandai kategori itu, judul belum dipakai pelatihan aktif, belum
//   pernah diubah admin; urut terbaru. Kategori dengan kandidat paling sedikit diisi lebih dulu.
// - Kategori yang kandidatnya kurang tetap di bawah 10 (pemilik: tidak mengarang judul).
// - Versi 2: kategori yang judul bertandanya habis diisi dari judul referensi lain yang topiknya sama
//   (CATEGORY_FILL_TOPIC_PICKS, dipilih manual dari judul di Sampah; tanpa judul kembar).
// Versi pertama: kategori berawalan A dan B yang tampil di publik.
import { getDb } from "../src/lib/db";
import { withRevalidateBatch } from "../src/lib/revalidate-map";
import { AuditAction, writeAudit } from "../src/services/audit";
import { restoreTraining } from "../src/services/training";
import snapshot from "./seed-data/reference-catalog.json";
import { hasReferenceTitle, plainTitle, referenceSnapshotSlugs } from "./seed-data/reference-training";

export const CATEGORY_FILL_KEY = "seed.categoryFill.version";
export const CATEGORY_FILL_VERSION = "2026-10-21-ab-topik";
export const CATEGORY_FILL_TARGET = 10;
export const CATEGORY_FILL_SLUGS = [
  "administrative",
  "akuakultur",
  "alignment",
  "analysis",
  "anger",
  "arsitektur",
  "assurance",
  "audit",
  "balanced-scorecard",
  "banking",
  "batu-bara",
  "behavioral",
  "budgeting",
  "building",
  "business",
];
// Slug pelatihan referensi (di Sampah) per kategori, urut prioritas; dipakai setelah judul bertanda habis.
export const CATEGORY_FILL_TOPIC_PICKS: Record<string, string[]> = {
  alignment: [
    "training-terminasi-tegangan-menengah-dan-jointing-di-jakarta-terbaru",
    "training-machinery-vibration-analysis-terbaru",
    "training-vibration-and-alignment",
    "training-balancing-and-total-alignment",
    "training-praktik-analisis-vibrasi-terupdate",
    "training-rotating-machine-maintenance",
    "training-rotating-equipment-operation-maintenance-and-troubleshooting",
    "pelatihan-bearing-selection-and-maintenance",
    "pelatihan-machinery-diagnostic-vibration-information-fundamentals-of-rotating-machinery-diagnostics",
  ],
  anger: [
    "training-emotional-control",
    "pelatihan-conflict-management-training",
    "training-managing-conflict-and-handling-difficult-people",
    "pelatihan-stress-time-management",
    "training-emotional-management-for-improvement-productivity",
    "pelatihan-kepemimpinan-berdasarkan-kecerdasan-emosi",
    "pelatihan-handling-conflict-at-work-place",
    "training-technique-of-emotional-freedom-technique",
    "pelatihan-conflict-collaboration",
  ],
  assurance: ["pelatihan-quality-assurance-for-internal-audit-department", "training-project-quality-management"],
  "balanced-scorecard": [
    "training-pengukuran-kinerja-perusahaan-berbasis-balanced-scorecard-di-jakarta",
    "training-performance-management",
    "teknik-penyusunan-casecading-kpi",
    "training-strategic-balanced-scorecard-penyusunan-kpi-bpr",
  ],
  behavioral: [
    "training-office-communication-and-behavior-ethic",
    "training-behavior-based-safety-bbs",
    "training-effective-skill-for-organization-behavior",
    "training-effective-solutions-for-unacceptable-employee-behavior",
    "training-conflict-management-human-behaviour-in-organization",
    "training-technique-interview-for-recruitment-bei-interview",
    "training-wawancara-kerja-efektif-untuk-rekrutmen-staf-atau-jalur-karir",
    "pelatihan-understanding-customer-behaviour",
    "training-analisa-pendeteksian-fraud-dengan-human-behavior-dan-nlp-terbaru",
  ],
  budgeting: [
    "training-strategic-planning-management-control-and-effective-budgeting",
    "training-rencana-anggaran-biaya-konstruksi",
    "training-penyusunan-anggaran-perawatan-bangunan-gedung-dan-fasilitas",
    "training-corporate-budgeting-training-concepts-applications",
    "training-budgeting-cost-control-for-coal-mining-industry",
    "training-strategic-plan-and-budgeting-perencanaan-strategi-dan-anggaran-rumah-sakit-tahun-2024-2025",
  ],
};

const db = getDb();
// Judul kembar = sama setelah awalan "Training/Pelatihan" dan tanda baca diabaikan
// (mis. "PELATIHAN QA & QC ..." dan "TRAINING QA & QC ...").
export const normalizeTitle = (title: string) =>
  plainTitle(title)
    .toLowerCase()
    .replace(/^(training|trainning|pelatihan)\s+/, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

export type CategoryFillPick = { categoryId: string; categorySlug: string; trainingId: string; slug: string; title: string };
export type CategoryFillPlan = { picks: CategoryFillPick[]; summary: { slug: string; before: number; after: number }[] };

// Rencana tanpa menulis apa pun (dipakai seed dan pratinjau).
export async function planCategoryFill(): Promise<CategoryFillPlan> {
  const [categories, active, trashed] = await Promise.all([
    db.category.findMany({
      where: { slug: { in: CATEGORY_FILL_SLUGS }, deletedAt: null },
      select: { id: true, slug: true, _count: { select: { trainings: { where: { training: { deletedAt: null } } } } } },
    }),
    db.training.findMany({ where: { deletedAt: null }, select: { slug: true, title: true } }),
    db.training.findMany({
      where: { deletedAt: { not: null }, updatedById: null },
      select: { id: true, slug: true, title: true },
    }),
  ]);
  const activeSlugs = new Set(active.map((row) => row.slug));
  const usedTitles = new Set(active.map((row) => normalizeTitle(row.title)));
  const trashedBySlug = new Map(trashed.map((row) => [row.slug, row]));
  const snapshotIdBySlug = new Map(snapshot.categories.map((category) => [category.slug, category.id]));

  const candidates = categories.map((category) => {
    const snapshotId = snapshotIdBySlug.get(category.slug);
    const rows = snapshot.posts
      .map((post, index) => ({ post, row: trashedBySlug.get(referenceSnapshotSlugs[index]) }))
      .filter(({ post, row }) => snapshotId !== undefined && post.categoryIds.includes(snapshotId) && hasReferenceTitle(post) && row)
      .filter(({ row }) => row && !activeSlugs.has(row.slug))
      .sort((a, b) => b.post.date.localeCompare(a.post.date) || (a.row?.slug ?? "").localeCompare(b.row?.slug ?? ""))
      .map(({ row }) => row as NonNullable<typeof row>);
    const topicRows = (CATEGORY_FILL_TOPIC_PICKS[category.slug] ?? [])
      .map((slug) => trashedBySlug.get(slug))
      .filter((row): row is NonNullable<typeof row> => !!row && !activeSlugs.has(row.slug));
    return { category, rows: [...rows, ...topicRows] };
  });

  const picks: CategoryFillPick[] = [];
  const summary: CategoryFillPlan["summary"] = [];
  const taken = new Set<string>();
  for (const { category, rows } of [...candidates].sort((a, b) => a.rows.length - b.rows.length || a.category.slug.localeCompare(b.category.slug))) {
    const before = category._count.trainings;
    let after = before;
    for (const row of rows) {
      if (after >= CATEGORY_FILL_TARGET) break;
      const title = normalizeTitle(row.title);
      if (taken.has(row.id) || usedTitles.has(title)) continue;
      taken.add(row.id);
      usedTitles.add(title);
      picks.push({ categoryId: category.id, categorySlug: category.slug, trainingId: row.id, slug: row.slug, title: row.title });
      after += 1;
    }
    summary.push({ slug: category.slug, before, after });
  }
  return { picks, summary: summary.sort((a, b) => a.slug.localeCompare(b.slug)) };
}

export type CategoryFillResult = { restored: number; summary: CategoryFillPlan["summary"]; failed: string[] };

export async function seedCategoryFill(): Promise<CategoryFillResult | "dilewati"> {
  const done = await db.siteSetting.findUnique({ where: { key: CATEGORY_FILL_KEY }, select: { value: true } });
  if (done?.value === CATEGORY_FILL_VERSION) return "dilewati";
  const owner = await db.user.findFirstOrThrow({ orderBy: { createdAt: "asc" }, select: { id: true } });
  const plan = await planCategoryFill();
  const failed: string[] = [];
  let restored = 0;

  await withRevalidateBatch(async () => {
    for (const pick of plan.picks) {
      try {
        // Service admin: cek slug, lepas redirect yang memakai path ini, audit RESTORE, revalidate.
        await restoreTraining(pick.trainingId, {}, owner.id);
        await db.$transaction(async (tx) => {
          const before = await tx.trainingCategory.findMany({ where: { trainingId: pick.trainingId }, select: { categoryId: true } });
          await tx.trainingCategory.deleteMany({ where: { trainingId: pick.trainingId } });
          await tx.trainingCategory.create({ data: { trainingId: pick.trainingId, categoryId: pick.categoryId } });
          await writeAudit(
            {
              userId: owner.id,
              action: AuditAction.UPDATE,
              entity: "Training",
              entityId: pick.trainingId,
              diff: {
                categoryIds: { from: before.map((link) => link.categoryId), to: [pick.categoryId] },
                source: "category-fill",
              },
            },
            tx,
          );
        });
        restored += 1;
      } catch (error) {
        failed.push(`${pick.slug} (${error instanceof Error ? error.message : String(error)})`);
      }
    }
  });

  await db.siteSetting.upsert({
    where: { key: CATEGORY_FILL_KEY },
    create: { key: CATEGORY_FILL_KEY, value: CATEGORY_FILL_VERSION },
    update: { value: CATEGORY_FILL_VERSION },
  });
  return { restored, summary: plan.summary, failed };
}
