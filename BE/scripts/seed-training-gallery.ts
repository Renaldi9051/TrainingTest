// Skrip foto manifest (prisma/seed-data/gallery/manifest.json) untuk database dev:
//
//   npm run db:seed:gallery            # dry run: tampilkan rencana, tidak mengubah apa pun
//   npm run db:seed:gallery -- --apply # unggah ke media library, pasang, lalu revalidate FE
//
// Aturannya ada di prisma/seed-manifest-gallery.ts; seed.ts menjalankan langkah yang sama di setiap
// seed (termasuk deploy). Menolak jalan selain di training_dev atau training_e2e.
import { getDb } from "../src/lib/db";
import { databaseName } from "../src/lib/env";
import { applyManifestGallery, planManifestGallery } from "../prisma/seed-manifest-gallery";

const ALLOWED_DATABASES = new Set(["training_dev", "training_e2e"]);
const APPLY = process.argv.includes("--apply");

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  const name = url ? databaseName(url) : "";
  if (!ALLOWED_DATABASES.has(name)) throw new Error(`Menolak jalan: database "${name}" bukan training_dev.`);

  console.info(`${APPLY ? "Menjalankan" : "Rencana (dry run, belum ada yang diubah)"} foto pelatihan di ${name}:\n`);
  const steps = await planManifestGallery();

  for (const item of steps.unchanged) console.info(`  [tetap] ${item.slug}: ${item.reasons.join(", ")}`);
  for (const step of steps.categories) {
    console.info(`  [ubah] kategori ${step.name}: gambar ${step.currentName ?? "(kosong)"} -> ${step.photo.file}`);
  }
  for (const step of steps.trainings) {
    const parts = [
      step.cover ? (step.previousCoverId ? "sampul (ganti foto pool lama)" : "sampul") : "dilewati: sampul sudah ada",
      step.gallery
        ? `galeri ${step.gallery.length} foto${step.previousImageIds.length > 0 ? " (ganti foto pool lama)" : ""}`
        : `dilewati: galeri sudah berisi ${step.previousImageIds.length} foto`,
    ];
    console.info(`  [isi] ${step.title}: ${parts.join(", ")}`);
  }
  for (const item of steps.missing) console.info(`  [tidak ditemukan] ${item}`);

  if (steps.categories.length === 0 && steps.trainings.length === 0) {
    console.info("\nTidak ada yang perlu diubah.");
    return;
  }
  if (!APPLY) {
    console.info("\nJalankan dengan --apply untuk menerapkan.");
    return;
  }
  const { uploaded, revalidated } = await applyManifestGallery(steps);
  console.info(`Media: ${uploaded} diunggah.`);
  console.info(revalidated ? "Cache FE direvalidasi." : "Revalidate FE gagal (FE tidak menyala?). Data tetap tersimpan.");
  console.info("Selesai.");
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error && error.message ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => getDb().$disconnect());
