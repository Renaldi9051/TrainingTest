// Skrip foto tema (prisma/seed-data/gallery/themes.json) untuk database dev:
//
//   npm run db:seed:themes            # dry run: tampilkan rencana, tidak mengubah apa pun
//   npm run db:seed:themes -- --apply # unggah ke media library, pasang, lalu revalidate FE
//
// Aturannya ada di prisma/seed-theme-gallery.ts; seed.ts menjalankan langkah yang sama di setiap
// seed (termasuk deploy). Menolak jalan selain di training_dev atau training_e2e.
// File media ditulis ke UPLOAD_DIR milik proses ini (.env host: ../uploads). Kalau BE yang melayani
// situs berjalan di Docker (volume `uploads`), file baru harus disalin ke volume itu, atau cukup
// biarkan seed di container `migrate` yang memasangnya saat `docker compose up`.
import { getDb } from "../src/lib/db";
import { databaseName } from "../src/lib/env";
import { applyThemeGallery, planThemeGallery } from "../prisma/seed-theme-gallery";

const ALLOWED_DATABASES = new Set(["training_dev", "training_e2e"]);
const APPLY = process.argv.includes("--apply");

function countBy<T>(items: T[], key: (item: T) => string): string {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(key(item), (counts.get(key(item)) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => `${name} ${count}`)
    .join(", ");
}

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  const name = url ? databaseName(url) : "";
  if (!ALLOWED_DATABASES.has(name)) throw new Error(`Menolak jalan: database "${name}" bukan training_dev.`);

  console.info(`${APPLY ? "Menjalankan" : "Rencana (dry run, belum ada yang diubah)"} foto tema di ${name}:\n`);
  const plan = await planThemeGallery();
  const covers = plan.trainings.filter((step) => step.cover).length;
  const galleries = plan.trainings.filter((step) => step.gallery).length;
  console.info(`  Gambar kategori: ${plan.categories.length} diisi/diganti (${countBy(plan.categories, (step) => step.theme)})`);
  console.info(`  Gambar kategori pilihan admin, tidak disentuh: ${plan.keptCategories}`);
  console.info(`  Pelatihan: ${plan.trainings.length} (sampul ${covers}, galeri ${galleries})`);
  console.info(`    per tema: ${countBy(plan.trainings, (step) => step.theme)}`);

  if (plan.categories.length === 0 && plan.trainings.length === 0) {
    console.info("\nTidak ada yang perlu diubah.");
    return;
  }
  if (!APPLY) {
    console.info("\nJalankan dengan --apply untuk menerapkan.");
    return;
  }
  const { uploaded, revalidated } = await applyThemeGallery(plan);
  console.info(`\nMedia: ${uploaded} diunggah.`);
  console.info(revalidated ? "Cache FE direvalidasi." : "Revalidate FE gagal (FE tidak menyala?). Data tetap tersimpan.");
  console.info("Selesai.");
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error && error.message ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => getDb().$disconnect());
