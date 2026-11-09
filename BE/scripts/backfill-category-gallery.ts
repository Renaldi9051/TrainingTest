// Backfill galeri kategori (Halaman Kategori v2) dari galeri pelatihan yang sudah ada:
//
//   npm run db:backfill:category-gallery            # dry run: tampilkan rencana, tidak mengubah apa pun
//   npm run db:backfill:category-gallery -- --apply # pasang galeri kategori, lalu revalidate FE
//
// Aturan:
// - Hanya kategori yang galerinya MASIH KOSONG yang diisi (idempoten: jalan ulang tidak menambah).
// - Foto diambil dari sampul + galeri (TrainingImage) pelatihan TAYANG di kategori itu, maks 4 foto.
//   Sampul kategori itu sendiri tidak dipakai (sudah tampil di hero).
// - Satu foto hanya untuk SATU galeri kategori (keputusan pemilik 9 Nov 2026), termasuk galeri yang
//   sudah terisi sebelumnya. Pembagian memakai matching maksimum (scripts/category-gallery-allocate.ts).
//   Kategori yang kekurangan foto unik dibiarkan < 4 foto (landing tampil grid sejajar) atau kosong
//   (section galeri disembunyikan); laporan menyebut kekurangannya untuk diisi pemilik lewat admin.
// - Utamakan 1 foto per pelatihan, pelatihan terbaru (publishedAt desc) dulu.
// - Non-destruktif: Training/TrainingImage tidak pernah diubah/dihapus; hanya menambah baris CategoryMedia.
// - Guard (scripts/backfill-guard.ts): tanpa flag hanya training_dev. Database lain (production)
//   hanya dengan --production DAN env CONFIRM_DB_NAME yang sama persis dengan nama database tujuan:
//     CONFIRM_DB_NAME=training_prod npm run db:backfill:category-gallery -- --production          # dry run
//     CONFIRM_DB_NAME=training_prod npm run db:backfill:category-gallery -- --production --apply  # terapkan
//
// Backup pg_dump database tujuan WAJIB sebelum menjalankan --apply (lihat PROMPT-KIRO-KATEGORI-V2.md).
import { getDb } from "../src/lib/db";
import { databaseName } from "../src/lib/env";
import { revalidateEntity } from "../src/lib/revalidate-map";
import { nonEmptyPublicCategoryWhere } from "../src/services/category";
import { publicTrainingWhere } from "../src/services/training-visibility";
import { CATEGORY_GALLERY_MAX } from "../src/lib/validators/category";
import { assertBackfillTarget } from "./backfill-guard";
import { allocateUniqueGallery, type GalleryCandidate, type GalleryCategoryInput } from "./category-gallery-allocate";

const APPLY = process.argv.includes("--apply");
const PRODUCTION = process.argv.includes("--production");

type PlannedPhoto = { mediaId: string; trainingTitle: string };
type PlannedCategory = {
  categoryId: string;
  slug: string;
  name: string;
  photos: PlannedPhoto[];
};

type TrainingPhotos = { title: string; cover: { id: string } | null; images: { mediaId: string }[] };

// Kandidat foto satu kategori, urut preferensi: tiap pelatihan (terbaru dulu) menyumbang sampulnya
// lalu foto galerinya. Bergiliran per ronde (ronde 0 = foto pertama tiap pelatihan, dst.) supaya
// foto tersebar ke banyak pelatihan.
function candidatePhotos(trainings: TrainingPhotos[], excludeMediaId: string | null): GalleryCandidate[] {
  const perTraining = trainings.map((training) => ({
    title: training.title,
    mediaIds: [...(training.cover ? [training.cover.id] : []), ...training.images.map((image) => image.mediaId)],
  }));
  const queue: GalleryCandidate[] = [];
  const maxLen = Math.max(0, ...perTraining.map((t) => t.mediaIds.length));
  for (let round = 0; round < maxLen; round += 1) {
    for (const training of perTraining) {
      const mediaId = training.mediaIds[round];
      if (mediaId && mediaId !== excludeMediaId) queue.push({ mediaId, label: training.title });
    }
  }
  return queue;
}

async function plan(now: Date): Promise<PlannedCategory[]> {
  const db = getDb();
  // Hanya kategori yang TAMPIL PUBLIK (belum dihapus + punya pelatihan tayang, sama dengan indeks
  // publik) dan galerinya masih kosong. Idempoten: kategori yang sudah punya galeri dilewati.
  const categories = await db.category.findMany({
    where: { ...nonEmptyPublicCategoryWhere(now), images: { none: {} } },
    select: { id: true, slug: true, name: true, imageId: true },
    orderBy: [{ order: "asc" }, { name: "asc" }],
  });

  // Foto yang sudah ada di galeri kategori lain tidak boleh dipakai lagi.
  const existing = await db.categoryMedia.findMany({ select: { mediaId: true } });
  const taken = new Set(existing.map((row) => row.mediaId));

  const inputs: GalleryCategoryInput[] = [];
  for (const category of categories) {
    const trainings = await db.training.findMany({
      where: { ...publicTrainingWhere(now), categories: { some: { categoryId: category.id } } },
      select: {
        title: true,
        cover: { where: { deletedAt: null }, select: { id: true } },
        images: {
          where: { media: { deletedAt: null } },
          orderBy: { order: "asc" },
          select: { mediaId: true },
        },
      },
      orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
    });
    // Sampul kategori itu sendiri tidak masuk galerinya (sudah tampil di hero halaman yang sama).
    inputs.push({ id: category.id, candidates: candidatePhotos(trainings, category.imageId) });
  }

  const allocation = allocateUniqueGallery(inputs, CATEGORY_GALLERY_MAX, taken);
  return categories.map((category) => ({
    categoryId: category.id,
    slug: category.slug,
    name: category.name,
    photos: (allocation.get(category.id) ?? []).map((photo) => ({ mediaId: photo.mediaId, trainingTitle: photo.label })),
  }));
}

async function apply(
  plans: PlannedCategory[],
): Promise<{ categories: number; photos: number; failedSlugs: string[] }> {
  const db = getDb();
  let photoCount = 0;
  for (const item of plans) {
    await db.categoryMedia.createMany({
      data: item.photos.map((photo, index) => ({ categoryId: item.categoryId, mediaId: photo.mediaId, order: index })),
      skipDuplicates: true,
    });
    photoCount += item.photos.length;
  }
  // Revalidate FE per kategori (tag category:<slug> + daftar). Di luar batch = dikirim langsung.
  // Gagal (FE tidak bisa dihubungi) tidak membatalkan backfill: dikumpulkan untuk dilaporkan.
  const failedSlugs: string[] = [];
  for (const item of plans) {
    const ok = await revalidateEntity({ entity: "Category", slugs: [item.slug] });
    if (!ok) failedSlugs.push(item.slug);
  }
  return { categories: plans.length, photos: photoCount, failedSlugs };
}

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  const name = url ? databaseName(url) : "";
  const { mode } = assertBackfillTarget({
    databaseName: name,
    production: PRODUCTION,
    confirmDbName: process.env.CONFIRM_DB_NAME,
  });
  if (mode === "production") {
    console.warn(`MODE PRODUCTION: database "${name}" (dikonfirmasi lewat CONFIRM_DB_NAME).`);
  }

  console.info(
    `${APPLY ? "Menjalankan" : "Rencana (dry run, belum ada yang diubah)"} backfill galeri kategori di ${name}:\n`,
  );
  const allPlans = await plan(new Date());
  if (allPlans.length === 0) {
    console.info("Tidak ada kategori tampil yang galerinya masih kosong.");
    return;
  }
  const plans = allPlans.filter((item) => item.photos.length > 0);
  const empty = allPlans.filter((item) => item.photos.length === 0);

  for (const item of plans) {
    const short = item.photos.length < CATEGORY_GALLERY_MAX ? ` (kurang ${CATEGORY_GALLERY_MAX - item.photos.length})` : "";
    console.info(`  [isi] ${item.name} (${item.slug}): ${item.photos.length} foto${short}`);
    for (const [index, photo] of item.photos.entries()) {
      console.info(`        ${String(index + 1).padStart(2, "0")}. media ${photo.mediaId}  <- ${photo.trainingTitle}`);
    }
  }

  // Daftar belanja foto: kategori yang belum dapat 4 foto unik, kekurangan terbanyak dulu.
  const shortfall = allPlans
    .filter((item) => item.photos.length < CATEGORY_GALLERY_MAX)
    .map((item) => ({ item, missing: CATEGORY_GALLERY_MAX - item.photos.length }))
    .sort((x, y) => y.missing - x.missing || x.item.slug.localeCompare(y.item.slug));
  if (shortfall.length > 0) {
    console.info("\nKategori yang kekurangan foto unik (tambahkan lewat admin):");
    for (const { item, missing } of shortfall) {
      const note = item.photos.length === 0 ? " [galeri tetap kosong, section disembunyikan]" : "";
      console.info(`  ${item.slug}: kurang ${missing}${note}`);
    }
  }

  const totalPhotos = plans.reduce((sum, p) => sum + p.photos.length, 0);
  const missingSlots = shortfall.reduce((sum, s) => sum + s.missing, 0);
  const full = plans.filter((p) => p.photos.length === CATEGORY_GALLERY_MAX).length;

  console.info("\nRingkasan:");
  console.info(`  Kategori galeri kosong      : ${allPlans.length}`);
  console.info(`  Kategori yang diisi         : ${plans.length} (${full} penuh ${CATEGORY_GALLERY_MAX} foto)`);
  console.info(`  Total foto dipasang (unik)  : ${totalPhotos}`);
  console.info(`  Kategori tetap kosong       : ${empty.length}`);
  console.info(`  Kekurangan slot             : ${missingSlots}`);

  if (!APPLY) {
    console.info("\nJalankan dengan --apply untuk menerapkan (pastikan sudah backup pg_dump).");
    return;
  }
  const { categories, photos, failedSlugs } = await apply(plans);
  console.info(`\nDipasang: ${photos} foto di ${categories} kategori.`);
  if (failedSlugs.length === 0) {
    console.info("Cache FE direvalidasi per kategori.");
  } else {
    console.warn(
      `\nPERINGATAN: revalidate FE gagal untuk ${failedSlugs.length} kategori (FE tidak dapat dihubungi). ` +
        "Data tersimpan; revalidasi ulang setelah FE menyala (mis. simpan ulang kategori di admin, atau panggil revalidate tag). Slug:",
    );
    for (const slug of failedSlugs) console.warn(`  category:${slug}`);
  }
  console.info("Selesai.");
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error && error.message ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => getDb().$disconnect());
