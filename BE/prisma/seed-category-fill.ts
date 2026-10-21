// Mengisi kategori sampai 10 pelatihan (permintaan pemilik, 21 Okt 2026), sekali per versi. Sumbernya
// judul web referensi yang sudah ada di database tapi dipindah ke Sampah oleh batas 10 pelatihan per
// kategori versi lama: dipulihkan lewat service admin (slug, redirect, audit) lalu diberi SATU kategori,
// yaitu kategori yang diisi. Uraian pelatihan tetap naskah seed sendiri (tidak menyalin isi situs lain).
// - Kandidat: artikel snapshot yang ditandai kategori itu, judul belum dipakai pelatihan aktif, belum
//   pernah diubah admin; urut terbaru. Kategori dengan kandidat paling sedikit diisi lebih dulu.
// - Kategori yang kandidatnya kurang tetap di bawah 10 (pemilik: tidak mengarang judul).
// - Versi 2: kategori yang judul bertandanya habis diisi dari judul referensi lain yang topiknya sama
//   (CATEGORY_FILL_TOPIC_PICKS, dipilih manual dari judul di Sampah; tanpa judul kembar).
// - Versi 3: database yang dipasang langsung dengan katalog terbatas (production) tidak punya judul itu
//   di Sampah. Judul snapshot yang belum pernah ada di database dibuat baru (naskah seed sama seperti
//   seed referensi); yang di Sampah tapi pernah diubah admin tetap tidak disentuh. Judul yang sudah
//   punya foto di training-photos.json didahulukan supaya hasilnya sama dengan dev.
// Versi pertama: kategori berawalan A dan B yang tampil di publik.
import type { Prisma } from "../src/generated/prisma/client";
import { getDb } from "../src/lib/db";
import { revalidateEntity, withRevalidateBatch } from "../src/lib/revalidate-map";
import { AuditAction, writeAudit } from "../src/services/audit";
import { restoreTraining } from "../src/services/training";
import snapshot from "./seed-data/reference-catalog.json";
import { hasReferenceTitle, plainTitle, referenceSnapshotSlugs, referenceTraining } from "./seed-data/reference-training";
import { loadTrainingPhotos } from "./seed-training-photos";

export const CATEGORY_FILL_KEY = "seed.categoryFill.version";
export const CATEGORY_FILL_VERSION = "2026-10-21-ab-buat";
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
    // Cadangan (database lain bisa sudah memakai judul di atas).
    "training-vibration-analysis-di-jakarta",
    "pelatihan-troubleshooting-bearing-failures",
    "training-electrical-mechanical-rotating-equipments-terbaru",
    "training-terminasi-dan-jointing-zoom",
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
    "training-managing-change-conflict",
    "training-emotional-inteligent-leadership",
    "pelatihan-conflict-growth-opportunity",
    "training-teknik-penyelesaian-konflik-dan-perselisihan-hubungan-industrial-di-tempat-kerja",
    "pelatihan-stress-conflict-management-for-secretary",
  ],
  assurance: [
    "pelatihan-quality-assurance-for-internal-audit-department",
    "training-project-quality-management",
    "pelatihan-best-practice-quality-assurance",
    "pelatihan-managing-quality-assurance-business-excellence",
    "training-leadership-for-quality-management",
    "pelatihan-fundamentals-total-quality-management",
  ],
  "balanced-scorecard": [
    "training-pengukuran-kinerja-perusahaan-berbasis-balanced-scorecard-di-jakarta",
    "training-performance-management",
    "teknik-penyusunan-casecading-kpi",
    "training-strategic-balanced-scorecard-penyusunan-kpi-bpr",
    "training-penilaian-kinerja-berbasis-balanced-scorecard-bsc",
    "training-metode-pengukuran-kinerja-dengan-key-performance-indicators-kpi",
    "pelatihan-employee-performance-management-di-jakarta",
    "training-performance-management-appraisal",
    "pelatihan-menyusun-rencana-stratejik-perusahaan-berbasis-balanced-scorecard-gratis",
    "training-performance-management-for-manager-from-performance-plan-to-appraisal",
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
    "training-teknik-interview-dalam-proses-rekrutmen",
    "pelatihan-faktor-faktor-yang-mempengaruhi-perilaku-konsumen",
    "pelatihan-effective-job-interview",
    "training-recruitment-interview-and-selection",
  ],
  budgeting: [
    "training-strategic-planning-management-control-and-effective-budgeting",
    "training-rencana-anggaran-biaya-konstruksi",
    "training-penyusunan-anggaran-perawatan-bangunan-gedung-dan-fasilitas",
    "training-corporate-budgeting-training-concepts-applications",
    "training-budgeting-cost-control-for-coal-mining-industry",
    "training-strategic-plan-and-budgeting-perencanaan-strategi-dan-anggaran-rumah-sakit-tahun-2024-2025",
    "training-budgeting-cost-control",
    "training-cost-control-budgeting-profit-planning",
    "pelatihan-advanced-financial-modelling-dan-effective-budgeting-perusahaan",
    "training-cost-reduction-and-cost-control",
    "training-costing-and-budgeting-for-open-pit-mining-project-terbaru",
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

// restore = baris di Sampah yang belum pernah diubah admin; create = judul snapshot yang belum ada di database.
export type CategoryFillSource = { kind: "restore"; trainingId: string } | { kind: "create"; postIndex: number };
export type CategoryFillPick = { categoryId: string; categorySlug: string; source: CategoryFillSource; slug: string; title: string };
export type CategoryFillPlan = { picks: CategoryFillPick[]; summary: { slug: string; before: number; after: number }[] };

type Candidate = { slug: string; title: string; source: CategoryFillSource; hasPhotos: boolean };

// Rencana tanpa menulis apa pun (dipakai seed dan pratinjau).
export async function planCategoryFill(): Promise<CategoryFillPlan> {
  const [categories, active, known, photos] = await Promise.all([
    db.category.findMany({
      where: { slug: { in: CATEGORY_FILL_SLUGS }, deletedAt: null },
      select: { id: true, slug: true, _count: { select: { trainings: { where: { training: { deletedAt: null } } } } } },
    }),
    db.training.findMany({ where: { deletedAt: null }, select: { slug: true, title: true } }),
    db.training.findMany({
      where: { slug: { in: referenceSnapshotSlugs } },
      select: { id: true, slug: true, deletedAt: true, updatedById: true },
    }),
    loadTrainingPhotos(),
  ]);
  const activeSlugs = new Set(active.map((row) => row.slug));
  const usedTitles = new Set(active.map((row) => normalizeTitle(row.title)));
  const knownSlugs = new Set(known.map((row) => row.slug));
  const restorable = new Map(
    known.filter((row) => row.deletedAt !== null && row.updatedById === null).map((row) => [row.slug, row.id]),
  );
  const indexBySlug = new Map(referenceSnapshotSlugs.map((slug, index) => [slug, index]));
  const snapshotIdBySlug = new Map(snapshot.categories.map((category) => [category.slug, category.id]));

  const candidate = (index: number): Candidate | null => {
    const post = snapshot.posts[index];
    const slug = referenceSnapshotSlugs[index];
    if (!post || !slug || !hasReferenceTitle(post) || activeSlugs.has(slug)) return null;
    const title = plainTitle(post.title).slice(0, 200);
    const hasPhotos = slug in photos.trainings;
    const trainingId = restorable.get(slug);
    if (trainingId) return { slug, title, source: { kind: "restore", trainingId }, hasPhotos };
    // Ada di database tapi tidak bisa dipulihkan (dihapus atau diubah admin): dibiarkan.
    if (knownSlugs.has(slug)) return null;
    return { slug, title, source: { kind: "create", postIndex: index }, hasPhotos };
  };

  const candidates = categories.map((category) => {
    const snapshotId = snapshotIdBySlug.get(category.slug);
    const tagged = snapshot.posts
      .map((post, index) => ({ post, index }))
      .filter(({ post }) => snapshotId !== undefined && post.categoryIds.includes(snapshotId))
      .sort(
        (a, b) =>
          b.post.date.localeCompare(a.post.date) ||
          referenceSnapshotSlugs[a.index].localeCompare(referenceSnapshotSlugs[b.index]),
      )
      .map(({ index }) => candidate(index));
    const topic = (CATEGORY_FILL_TOPIC_PICKS[category.slug] ?? []).map((slug) => {
      const index = indexBySlug.get(slug);
      return index === undefined ? null : candidate(index);
    });
    const rows = [...tagged, ...topic].filter((row): row is Candidate => row !== null);
    // Urutan asal tetap, yang sudah punya foto unik didahulukan.
    return { category, rows: [...rows.filter((row) => row.hasPhotos), ...rows.filter((row) => !row.hasPhotos)] };
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
      if (taken.has(row.slug) || usedTitles.has(title)) continue;
      taken.add(row.slug);
      usedTitles.add(title);
      picks.push({ categoryId: category.id, categorySlug: category.slug, source: row.source, slug: row.slug, title: row.title });
      after += 1;
    }
    summary.push({ slug: category.slug, before, after });
  }
  return { picks, summary: summary.sort((a, b) => a.slug.localeCompare(b.slug)) };
}

// Pelatihan baru dari judul snapshot: naskah dan field sama dengan seed referensi. updatedById diisi
// (seperti baris yang dipulihkan) supaya perapian katalog referensi berikutnya tidak memindahkannya ke Sampah.
async function createFromSnapshot(pick: CategoryFillPick, postIndex: number, ownerId: string) {
  const item = referenceTraining({ ...snapshot.posts[postIndex], slug: pick.slug });
  await db.$transaction(async (tx) => {
    const training = await tx.training.create({
      data: {
        slug: pick.slug,
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
        types: ["PUBLIC", "IN_HOUSE"],
        priceText: null,
        showPrice: false,
        status: "PUBLISHED",
        publishedAt: item.publishedAt,
        publishRevalidatedAt: item.publishedAt,
        updatedById: ownerId,
        categories: { create: { categoryId: pick.categoryId } },
      },
      select: { id: true },
    });
    await writeAudit(
      {
        userId: ownerId,
        action: AuditAction.CREATE,
        entity: "Training",
        entityId: training.id,
        diff: { categoryIds: { from: [], to: [pick.categoryId] }, source: "category-fill" },
      },
      tx,
    );
  });
  await revalidateEntity({ entity: "Training", slugs: [pick.slug] });
}

export type CategoryFillResult = { restored: number; created: number; summary: CategoryFillPlan["summary"]; failed: string[] };

export async function seedCategoryFill(): Promise<CategoryFillResult | "dilewati"> {
  const done = await db.siteSetting.findUnique({ where: { key: CATEGORY_FILL_KEY }, select: { value: true } });
  if (done?.value === CATEGORY_FILL_VERSION) return "dilewati";
  const owner = await db.user.findFirstOrThrow({ orderBy: { createdAt: "asc" }, select: { id: true } });
  const plan = await planCategoryFill();
  const failed: string[] = [];
  let restored = 0;
  let created = 0;

  await withRevalidateBatch(async () => {
    for (const pick of plan.picks) {
      try {
        if (pick.source.kind === "create") {
          await createFromSnapshot(pick, pick.source.postIndex, owner.id);
          created += 1;
          continue;
        }
        const trainingId = pick.source.trainingId;
        // Service admin: cek slug, lepas redirect yang memakai path ini, audit RESTORE, revalidate.
        await restoreTraining(trainingId, {}, owner.id);
        await db.$transaction(async (tx) => {
          const before = await tx.trainingCategory.findMany({ where: { trainingId }, select: { categoryId: true } });
          await tx.trainingCategory.deleteMany({ where: { trainingId } });
          await tx.trainingCategory.create({ data: { trainingId, categoryId: pick.categoryId } });
          await writeAudit(
            {
              userId: owner.id,
              action: AuditAction.UPDATE,
              entity: "Training",
              entityId: trainingId,
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
  return { restored, created, summary: plan.summary, failed };
}
