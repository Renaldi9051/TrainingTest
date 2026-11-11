// Sisa katalog referensi (lihat prisma/seed-catalog-rest.ts). `--dry-run`: hanya laporan per kategori,
// tanpa menulis. Tanpa flag: sama seperti langkah di `prisma db seed` (sekali per versi).
import { describeCatalogRest, loadCatalogRestPlan, loadRecategorizePlan, seedCatalogRest } from "../prisma/seed-catalog-rest";
import { getDb } from "../src/lib/db";

const db = getDb();

type Row = { slug: string; before: number; after: number };
const print = (rows: Row[]) => {
  for (const item of [...rows].sort((a, b) => b.after - b.before - (a.after - a.before))) {
    console.info(`${item.slug.padEnd(40)} ${String(item.before).padStart(4)} -> ${String(item.after).padStart(4)}`);
  }
};

async function main() {
  if (!process.argv.includes("--dry-run")) {
    console.info(describeCatalogRest(await seedCatalogRest()));
    return;
  }
  const recategorize = await loadRecategorizePlan();
  console.info(`Pindah kategori (hasil versi lama, dari judul): ${recategorize.moves.length} pelatihan, ${recategorize.summary.length} kategori berubah.`);
  print(recategorize.summary);
  // Penambahan dihitung dari isi database sekarang (sebelum pemindahan di atas diterapkan).
  const plan = await loadCatalogRestPlan();
  const restore = plan.picks.filter((pick) => pick.source.kind === "restore").length;
  console.info(
    `Tambahan: ${plan.picks.length} pelatihan (${restore} dipulihkan, ${plan.picks.length - restore} dibuat); dilewati ` +
      `${plan.skipped.duplicate} kembar, ${plan.skipped.noCategory} tanpa kategori, ${plan.skipped.protectedRows} dihapus/diubah admin, ` +
      `${plan.skipped.untitled} tanpa judul. Kategori bertambah: ${plan.summary.length}.`,
  );
  print(plan.summary);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => db.$disconnect());
