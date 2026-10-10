import { existsSync } from "node:fs";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";
import { E2E_BE_ORIGIN, E2E_FE_ORIGIN } from "./e2e/e2e-env";

// E2E tidak pernah memakai training_dev. Playwright menyalakan BE (4100) & FE (3100) khusus e2e yang
// memakai database training_e2e (DATABASE_URL_E2E), lalu global setup me-reset + seed database itu.
// Butuh container Postgres (npm run db:up dari BE/). Kredensial admin dibaca dari .env root
// (ADMIN_EMAIL, ADMIN_PASSWORD) khusus untuk test; kode app FE tidak membacanya.
const rootEnv = path.resolve(__dirname, "../.env");
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const baseURL = E2E_FE_ORIGIN;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL,
    trace: "retain-on-failure",
    locale: "id-ID",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Server e2e selalu dinyalakan baru (tidak pernah memakai ulang server lain di port itu), BE dulu
  // lalu FE. Keduanya memakai folder build .next/e2e, jadi bisa jalan bersama `npm run dev`.
  webServer: [
    {
      command: "npm run dev:e2e",
      cwd: "../BE",
      url: `${E2E_BE_ORIGIN}/api/health`,
      reuseExistingServer: false,
      timeout: 180_000,
    },
    {
      command: "npm run dev:e2e",
      url: `${baseURL}/admin/login`,
      reuseExistingServer: false,
      timeout: 180_000,
      env: { E2E_SERVER: "1", BE_INTERNAL_URL: E2E_BE_ORIGIN, NEXT_PUBLIC_SITE_URL: E2E_FE_ORIGIN },
    },
  ],
  // Dijalankan setelah server siap: reset + seed training_e2e.
  globalSetup: "./e2e/global-setup.ts",
});
