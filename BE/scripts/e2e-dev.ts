// Server BE untuk Playwright (FE/playwright.config.ts): port 4100, database training_e2e,
// folder upload sementara, dan folder build sendiri supaya bisa jalan bersama `npm run dev`.
import { spawn } from "node:child_process";
import {
  BE_ROOT,
  E2E_BE_PORT,
  E2E_FE_ORIGIN,
  e2eDatabaseUrl,
  ensureE2eDatabase,
  runWithDatabase,
} from "./e2e-shared";
import { createE2eUploadDir } from "./e2e-uploads";

async function main() {
  const url = e2eDatabaseUrl();
  // Health check & scheduler butuh database bertabel; isinya di-reset global setup setelah server siap.
  await ensureE2eDatabase(url);
  runWithDatabase("npx prisma migrate deploy", url);

  const child = spawn(`npx next dev -p ${E2E_BE_PORT}`, {
    cwd: BE_ROOT,
    shell: true,
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_URL: url,
      // Dihapus global teardown Playwright (npm run e2e:cleanup).
      UPLOAD_DIR: createE2eUploadDir(),
      PUBLIC_BASE_URL: E2E_FE_ORIGIN,
      FE_REVALIDATE_URL: `${E2E_FE_ORIGIN}/api/revalidate`,
      ALLOWED_ORIGINS: E2E_FE_ORIGIN,
      // e2e menguji perilaku produksi, walau .env lokal memakai "skip" untuk Docker.
      RATE_LIMIT_UNKNOWN_IP: "shared",
      E2E_SERVER: "1",
    },
  });
  child.on("exit", (code) => process.exit(code ?? 0));
  for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => child.kill(signal));
}

main().catch((error: unknown) => {
  // AggregateError (mis. Postgres tidak menyala) tidak punya message: cetak error utuh.
  console.error(error instanceof Error && error.message ? error.message : error);
  process.exit(1);
});
