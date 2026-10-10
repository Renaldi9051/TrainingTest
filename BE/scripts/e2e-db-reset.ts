// Reset database e2e sebelum setiap run Playwright (FE/e2e/global-setup.ts):
// drop + create training_e2e, terapkan semua migrasi, lalu seed. Menolak database lain.
import { e2eDatabaseUrl, recreateE2eDatabase, runWithDatabase } from "./e2e-shared";

async function main() {
  const url = e2eDatabaseUrl();
  await recreateE2eDatabase(url);
  runWithDatabase("npx prisma migrate deploy", url);
  runWithDatabase("npx prisma db seed", url);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
