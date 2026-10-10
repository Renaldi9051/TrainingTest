// Server BE untuk Playwright (FE/playwright.config.ts): port 4100, database training_e2e,
// folder upload sementara, dan folder build sendiri supaya bisa jalan bersama `npm run dev`.
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  BE_ROOT,
  E2E_BE_PORT,
  E2E_FE_ORIGIN,
  e2eDatabaseUrl,
  ensureE2eDatabase,
  runWithDatabase,
} from "./e2e-shared";

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
      UPLOAD_DIR: mkdtempSync(path.join(os.tmpdir(), "training-e2e-uploads-")),
      PUBLIC_BASE_URL: E2E_FE_ORIGIN,
      FE_REVALIDATE_URL: `${E2E_FE_ORIGIN}/api/revalidate`,
      ALLOWED_ORIGINS: E2E_FE_ORIGIN,
      E2E_SERVER: "1",
    },
  });
  child.on("exit", (code) => process.exit(code ?? 0));
  for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => child.kill(signal));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
