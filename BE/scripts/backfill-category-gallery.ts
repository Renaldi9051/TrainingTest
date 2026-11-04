// Backfill galeri kategori (Halaman Kategori v2) dari galeri pelatihan yang sudah ada:
//
//   npm run db:backfill:category-gallery            # dry run: tampilkan rencana, tidak mengubah apa pun
//   npm run db:backfill:category-gallery -- --apply # pasang galeri kategori, lalu revalidate FE
//
// Aturan:
// - Hanya kategori yang galerinya MASIH KOSONG yang diisi (idempoten: jalan ulang tidak menambah).
// - Foto diambil dari galeri (TrainingImage) pelatihan TAYANG di kategori itu, maks 4 foto.
// - Utamakan 1 foto per pelatihan, pelatihan terbaru (publishedAt desc) dulu; sisanya diisi foto
//   berikutnya dari pelatihan yang sama sampai 4.
// - Non-destruktif: TrainingImage tidak pernah diubah/dihapus; hanya menambah baris CategoryMedia.
// - Guard: hanya database training_dev (menolak *prod* dan training_e2e).
//
// Backup pg_dump DB dev WAJIB sebelum menjalankan --apply (lihat PROMPT-KIRO-KATEGORI-V2.md).
import { getDb } from "../src/lib/db";
import { databaseName } from "../src/lib/env";
import { revalidateEntity } from "../src/lib/revalidate-map";
import { nonEmptyPublicCategoryWhere } from "../src/services/category";
import { publicTrainingWhere } from "../src/services/training-visibility";
import { CATEGORY_GALLERY_MAX } from "../src/lib/validators/category";

const APPLY = process.argv.includes("--apply");

type PlannedPhoto = { mediaId: string; trainingTitle: string; reused: boolean };
type PlannedCategory = {
  categoryId: string;
  slug: string;
  name: string;
  photos: PlannedPhoto[];
};

// Kandidat foto per kategori: tiap pelatihan (terbaru dulu) menyumbang fotonya berurutan.
// Dikembalikan sebagai antrean putaran: ronde 0 = foto pertama tiap pelatihan, dst.
function candidatePhotos(
  trainings: { title: string; images: { mediaId: string }[] }[],
): { mediaId: string; trainingTitle: string }[] {
  const queue: { mediaId: string; trainingTitle: string }[] = [];
  const maxLen = Math.max(0, ...trainings.map((t) => t.images.length));
  // Utamakan sebaran: 1 foto per pelatihan dulu (ronde 0), baru foto berikutnya (ronde 1, ...).
  for (let round = 0; round < maxLen; round += 1) {
    for (const training of trainings) {
      const photo = training.images[round];
      if (photo) queue.push({ mediaId: photo.mediaId, trainingTitle: training.title });
    }
  }
  return queue;
}

// Pilih maks N foto dari antrean kandidat, utamakan media yang belum dipakai kategori lain
// (globalUsed). Foto yang sama (sudah dipakai kategori lain) hanya dipakai kalau tidak ada
// pilihan lain untuk memenuhi slot. Tidak pernah mengulang media yang sama dalam satu kategori.
function pickPhotos(
  candidates: { mediaId: string; trainingTitle: string }[],
  globalUsed: Set<string>,
  max: number,
): PlannedPhoto[] {
  const picked: PlannedPhoto[] = [];
  const localSeen = new Set<string>();

  // Lewat 1: hanya media yang belum pernah dipakai kategori mana pun.
  for (const candidate of candidates) {
    if (picked.length >= max) break;
    if (localSeen.has(candidate.mediaId) || globalUsed.has(candidate.mediaId)) continue;
    localSeen.add(candidate.mediaId);
    picked.push({ ...candidate, reused: false });
  }
  // Lewat 2: isi sisa slot dengan media yang sudah dipakai kategori lain (reuse), kalau perlu.
  for (const candidate of candidates) {
    if (picked.length >= max) break;
    if (localSeen.has(candidate.mediaId)) continue;
    localSeen.add(candidate.mediaId);
    picked.push({ ...candidate, reused: true });
  }
  return picked;
}

async function plan(now: Date): Promise<PlannedCategory[]> {
  const db = getDb();
  // Hanya kategori yang TAMPIL PUBLIK (belum dihapus + punya pelatihan tayang, sama dengan indeks
  // publik) dan galerinya masih kosong. Idempoten: kategori yang sudah punya galeri dilewati.
  const categories = await db.category.findMany({
    where: { ...nonEmptyPublicCategoryWhere(now), images: { none: {} } },
    select: { id: true, slug: true, name: true },
    orderBy: [{ order: "asc" }, { name: "asc" }],
  });

  // Media yang sudah dialokasikan ke kategori lain dalam rencana ini, untuk utamakan foto unik.
  const globalUsed = new Set<string>();
  const result: PlannedCategory[] = [];
  for (const category of categories) {
    const trainings = await db.training.findMany({
      where: {
        ...publicTrainingWhere(now),
        categories: { some: { categoryId: category.id } },
        images: { some: { media: { deletedAt: null } } },
      },
      select: {
        title: true,
        images: {
          where: { media: { deletedAt: null } },
          orderBy: { order: "asc" },
          select: { mediaId: true },
        },
      },
      orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
    });
    const photos = pickPhotos(candidatePhotos(trainings), globalUsed, CATEGORY_GALLERY_MAX);
    if (photos.length === 0) continue;
    for (const photo of photos) globalUsed.add(photo.mediaId);
    result.push({ categoryId: category.id, slug: category.slug, name: category.name, photos });
  }
  return result;
}

async function apply(plans: PlannedCategory[]): Promise<{ categories: number; photos: number; revalidated: boolean }> {
  const db = getDb();
  let photoCount = 0;
  const slugs: string[] = [];
  for (const item of plans) {
    await db.categoryMedia.createMany({
      data: item.photos.map((photo, index) => ({ categoryId: item.categoryId, mediaId: photo.mediaId, order: index })),
      skipDuplicates: true,
    });
    photoCount += item.photos.length;
    slugs.push(item.slug);
  }
  // Revalidate di luar batch (skrip): kirim langsung. Gagal tidak membatalkan backfill.
  const revalidated = slugs.length > 0 ? await revalidateEntity({ entity: "Category", slugs }) : true;
  return { categories: plans.length, photos: photoCount, revalidated };
}

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  const name = url ? databaseName(url) : "";
  if (name !== "training_dev") {
    throw new Error(`Menolak jalan: database "${name}" bukan training_dev.`);
  }

  console.info(
    `${APPLY ? "Menjalankan" : "Rencana (dry run, belum ada yang diubah)"} backfill galeri kategori di ${name}:\n`,
  );
  const plans = await plan(new Date());

  if (plans.length === 0) {
    console.info("Tidak ada kategori kosong yang bisa diisi dari galeri pelatihan.");
    return;
  }

  for (const item of plans) {
    const short = item.photos.length < CATEGORY_GALLERY_MAX ? ` (kurang dari ${CATEGORY_GALLERY_MAX})` : "";
    console.info(`  [isi] ${item.name} (${item.slug}): ${item.photos.length} foto${short}`);
    for (const [index, photo] of item.photos.entries()) {
      const tag = photo.reused ? " [dipakai ulang]" : "";
      console.info(`        ${String(index + 1).padStart(2, "0")}. media ${photo.mediaId}${tag}  <- ${photo.trainingTitle}`);
    }
  }

  const totalPhotos = plans.reduce((sum, p) => sum + p.photos.length, 0);
  const shortCategories = plans.filter((p) => p.photos.length < CATEGORY_GALLERY_MAX).length;
  // Media yang muncul di lebih dari satu galeri kategori.
  const mediaCount = new Map<string, number>();
  for (const item of plans) for (const photo of item.photos) mediaCount.set(photo.mediaId, (mediaCount.get(photo.mediaId) ?? 0) + 1);
  const reusedMedia = [...mediaCount.values()].filter((count) => count > 1).length;

  console.info("\nRingkasan:");
  console.info(`  Kategori yang diisi      : ${plans.length}`);
  console.info(`  Total foto dipasang      : ${totalPhotos}`);
  console.info(`  Kategori < ${CATEGORY_GALLERY_MAX} foto        : ${shortCategories}`);
  console.info(`  Media dipakai > 1 galeri : ${reusedMedia}`);

  if (!APPLY) {
    console.info("\nJalankan dengan --apply untuk menerapkan (pastikan sudah backup pg_dump).");
    return;
  }
  const { categories, photos, revalidated } = await apply(plans);
  console.info(`\nDipasang: ${photos} foto di ${categories} kategori.`);
  console.info(revalidated ? "Cache FE direvalidasi." : "Revalidate FE gagal (FE tidak menyala?). Data tetap tersimpan.");
  console.info("Selesai.");
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error && error.message ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => getDb().$disconnect());
