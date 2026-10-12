// Reset database e2e sebelum setiap run Playwright (FE/e2e/global-setup.ts):
// drop + create training_e2e, terapkan semua migrasi, lalu seed. Menolak database lain.
import { e2eDatabaseUrl, recreateE2eDatabase, runWithDatabase } from "./e2e-shared";

async function main() {
  const url = e2eDatabaseUrl();
  await recreateE2eDatabase(url);
  runWithDatabase("npx prisma migrate deploy", url);
  // Seed minimal: admin, pengaturan, menu, katalog, halaman profil. Konten lain dibuat test sendiri.
  runWithDatabase("npx prisma db seed -- --minimal", url);
}

main().catch((error: unknown) => {
  // AggregateError (mis. Postgres tidak menyala) tidak punya message: cetak error utuh.
  console.error(error instanceof Error && error.message ? error.message : error);
  process.exit(1);
});
