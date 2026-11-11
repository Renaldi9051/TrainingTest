// Kategori tambahan referensi (lihat prisma/seed-catalog-tags.ts). `--dry-run`: hanya laporan per
// kategori, tanpa menulis. Tanpa flag: sama seperti langkah di `prisma db seed` (sekali per versi).
import { describeCatalogTags, loadCatalogTagsPlan, seedCatalogTags } from "../prisma/seed-catalog-tags";
import { getDb } from "../src/lib/db";

const db = getDb();

async function main() {
  if (!process.argv.includes("--dry-run")) {
    console.info(describeCatalogTags(await seedCatalogTags()));
    return;
  }
  const plan = await loadCatalogTagsPlan();
  const links = plan.adds.reduce((total, add) => total + add.addIds.length, 0);
  console.info(
    `Kategori tambahan: ${links} tautan di ${plan.adds.length} pelatihan, ${plan.summary.length} kategori bertambah; ` +
      `dilewati ${plan.skipped.noSource} tanpa sumber, ${plan.skipped.adminChanged} kategorinya diubah admin.`,
  );
  for (const item of [...plan.summary].sort((a, b) => b.after - b.before - (a.after - a.before))) {
    console.info(`${item.slug.padEnd(40)} ${String(item.before).padStart(4)} -> ${String(item.after).padStart(5)}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => db.$disconnect());
