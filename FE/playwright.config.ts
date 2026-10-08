import { existsSync } from "node:fs";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

// E2E butuh database dev (npm run db:up dari BE/) dan admin hasil seed. Kredensial admin dibaca dari
// .env root (ADMIN_EMAIL, ADMIN_PASSWORD) khusus untuk test; kode app FE tidak membacanya.
const rootEnv = path.resolve(__dirname, "../.env");
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const baseURL = "http://localhost:3000";

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
  // Pakai server dev yang sudah jalan kalau ada; kalau tidak, nyalakan BE lalu FE.
  webServer: [
    {
      command: "npm run dev",
      cwd: "../BE",
      url: "http://localhost:4000/api/health",
      reuseExistingServer: true,
      timeout: 180_000,
    },
    {
      command: "npm run dev",
      url: `${baseURL}/admin/login`,
      reuseExistingServer: true,
      timeout: 180_000,
    },
  ],
});
