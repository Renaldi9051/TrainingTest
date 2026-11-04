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
import { CATEGORY_GALLERY_MAX } from "../src/lib/validators/category";

const APPLY = process.argv.includes("--apply");

type PlannedPhoto = { mediaId: string; trainingTitle: string };
type PlannedCategory = {
  categoryId: string;
  slug: string;
  name: string;
  photos: PlannedPhoto[];
};

// Pilih maks CATEGORY_GALLERY_MAX foto: 1 per pelatihan (terbaru dulu), lalu putaran berikutnya.
function pickPhotos(
  trainings: { title: string; images: { mediaId: string }[] }[],
): PlannedPhoto[] {
  const picked: PlannedPhoto[] = [];
  const seenMedia = new Set<string>();
  let round = 0;
  // Beberapa putaran: ambil foto ke-`round` dari tiap pelatihan sampai penuh atau habis.
  while (picked.length < CATEGORY_GALLERY_MAX) {
    let addedThisRound = false;
    for (const training of trainings) {
      if (picked.length >= CATEGORY_GALLERY_MAX) break;
      const photo = training.images[round];
      if (!photo || seenMedia.has(photo.mediaId)) continue;
      seenMedia.add(photo.mediaId);
      picked.push({ mediaId: photo.mediaId, trainingTitle: training.title });
      addedThisRound = true;
    }
    if (!addedThisRound) break;
    round += 1;
  }
  return picked;
}

async function plan(now: Date): Promise<PlannedCategory[]> {
  const db = getDb();
  // Kategori aktif yang galerinya masih kosong.
  const categories = await db.category.findMany({
    where: { deletedAt: null, images: { none: {} } },
    select: { id: true, slug: true, name: true },
    orderBy: [{ order: "asc" }, { name: "asc" }],
  });

  const result: PlannedCategory[] = [];
  for (const category of categories) {
    // Pelatihan tayang di kategori ini yang punya foto galeri, terbaru dulu.
    const trainings = await db.training.findMany({
      where: {
        deletedAt: null,
        status: "PUBLISHED",
        publishedAt: { lte: now },
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
    const photos = pickPhotos(trainings);
    if (photos.length > 0) result.push({ categoryId: category.id, slug: category.slug, name: category.name, photos });
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
    console.info(`  [isi] ${item.name} (${item.slug}): ${item.photos.length} foto`);
    for (const [index, photo] of item.photos.entries()) {
      console.info(`        ${String(index + 1).padStart(2, "0")}. media ${photo.mediaId}  <- ${photo.trainingTitle}`);
    }
  }
  console.info(
    `\nTotal: ${plans.length} kategori, ${plans.reduce((sum, p) => sum + p.photos.length, 0)} foto akan dipasang.`,
  );

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
