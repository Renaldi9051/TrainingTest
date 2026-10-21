// Merapikan kategori katalog referensi (keputusan pemilik, 21 Okt 2026), sekali per versi:
// 1. kata kunci untuk kategori yang isinya jauh lebih sedikit dari judul yang cocok, lalu semua
//    pelatihan yang judulnya cocok ditautkan (hanya menambah tautan);
// 2. kategori kembar digabung ke satu kategori (tautan pindah, redirect 301, menu diarahkan ulang);
// 3. kategori generik (bukan topik) dilepas dari pelatihan lalu dipindah ke Sampah.
// Semua langkah memakai service admin yang sama (audit atas nama admin pertama) dan hanya
// menyentuh kategori yang belum pernah diubah admin (updatedById kosong). Langkah yang dilewati
// dicatat di ringkasan seed; selanjutnya kategori diatur admin.
import { getDb } from "../src/lib/db";
import { HttpError } from "../src/lib/http";
import { withRevalidateBatch } from "../src/lib/revalidate-map";
import { deleteCategory, updateCategory } from "../src/services/category";
import { findKeywordMatchIds, linkKeywordMatches } from "../src/services/category-keywords";
import { mergeCategory } from "../src/services/category-merge";

export const CATEGORY_CLEANUP_KEY = "seed.categoryCleanup.version";
export const CATEGORY_CLEANUP_VERSION = "2026-10-21-keywords-4-merge-6-generic-4";

export const CLEANUP_KEYWORDS: Record<string, string[]> = {
  drone: ["drone"],
  mapping: ["mapping"],
  pemetaan: ["pemetaan"],
  survey: ["survey", "survei"],
};

// Sumber -> tujuan (slug). rename: nama baru untuk kategori tujuan.
export const CLEANUP_MERGES: { from: string; to: string; rename?: string }[] = [
  { from: "teknik-elektrikal", to: "electrical", rename: "Electrical" },
  { from: "manufactur", to: "manufacture" },
  { from: "secretarial", to: "secretary" },
  { from: "investmenyt", to: "investment" },
  { from: "property", to: "properties" },
  { from: "teknik-lingkungan-hse", to: "healthy-safety-environtmental", rename: "Health, Safety & Environment" },
];

export const CLEANUP_GENERIC = ["training", "pelatihan", "slider", "uncategorized"];

export type CategoryCleanupResult = {
  keywordCategories: number;
  linksAdded: number;
  merged: number;
  movedTrainings: number;
  deleted: number;
  detachedLinks: number;
  skipped: string[];
};

const db = getDb();

// Kategori aktif per slug; null kalau tidak ada. edited = pernah diubah admin.
async function findBySlug(slug: string) {
  const row = await db.category.findFirst({
    where: { slug, deletedAt: null },
    select: { id: true, slug: true, name: true, keywords: true, updatedById: true },
  });
  return row ? { ...row, edited: row.updatedById !== null } : null;
}

export async function seedCategoryCleanup(): Promise<CategoryCleanupResult | "dilewati"> {
  const done = await db.siteSetting.findUnique({ where: { key: CATEGORY_CLEANUP_KEY }, select: { value: true } });
  if (done?.value === CATEGORY_CLEANUP_VERSION) return "dilewati";
  const owner = await db.user.findFirstOrThrow({ orderBy: { createdAt: "asc" }, select: { id: true } });
  const result: CategoryCleanupResult = {
    keywordCategories: 0,
    linksAdded: 0,
    merged: 0,
    movedTrainings: 0,
    deleted: 0,
    detachedLinks: 0,
    skipped: [],
  };

  await withRevalidateBatch(async () => {
    for (const [slug, keywords] of Object.entries(CLEANUP_KEYWORDS)) {
      const category = await findBySlug(slug);
      if (!category) continue;
      if (category.edited || category.keywords.length > 0) {
        result.skipped.push(`kata kunci ${slug} (sudah diatur admin)`);
        continue;
      }
      await updateCategory(category.id, { keywords }, owner.id);
      result.keywordCategories += 1;
      const unlinked = (await findKeywordMatchIds(category.id, keywords)).filter((row) => !row.linked);
      if (unlinked.length > 0) {
        const { linked } = await linkKeywordMatches(category.id, { trainingIds: unlinked.map((row) => row.id) }, owner.id);
        result.linksAdded += linked;
      }
    }

    for (const { from, to, rename } of CLEANUP_MERGES) {
      const [source, target] = await Promise.all([findBySlug(from), findBySlug(to)]);
      if (!source || !target) {
        if (source || target) result.skipped.push(`gabung ${from} -> ${to} (salah satu kategori tidak aktif)`);
        continue;
      }
      if (source.edited || target.edited) {
        result.skipped.push(`gabung ${from} -> ${to} (sudah diubah admin)`);
        continue;
      }
      // Ganti nama dulu: setelah digabung tujuan tercatat diubah admin.
      if (rename && rename !== target.name) await updateCategory(target.id, { name: rename }, owner.id);
      const { movedTrainings } = await mergeCategory(source.id, { targetId: target.id }, owner.id);
      result.merged += 1;
      result.movedTrainings += movedTrainings;
    }

    for (const slug of CLEANUP_GENERIC) {
      const category = await findBySlug(slug);
      if (!category) continue;
      if (category.edited) {
        result.skipped.push(`hapus ${slug} (sudah diubah admin)`);
        continue;
      }
      const links = await db.trainingCategory.count({ where: { categoryId: category.id } });
      try {
        await deleteCategory(category.id, owner.id, { detach: true });
        result.deleted += 1;
        result.detachedLinks += links;
      } catch (error) {
        if (!(error instanceof HttpError) || error.code !== "CATEGORY_ONLY_CATEGORY") throw error;
        result.skipped.push(`hapus ${slug} (${error.message})`);
      }
    }
  });

  await db.siteSetting.upsert({
    where: { key: CATEGORY_CLEANUP_KEY },
    create: { key: CATEGORY_CLEANUP_KEY, value: CATEGORY_CLEANUP_VERSION },
    update: { value: CATEGORY_CLEANUP_VERSION },
  });
  return result;
}
