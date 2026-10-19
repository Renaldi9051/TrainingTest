import { defineConfig, devices } from "@playwright/test";

// Screenshot manual (cek visual redesign), BUKAN suite e2e: tidak menyalakan server dan tidak
// me-reset database. Jalankan terhadap server dev yang sudah hidup, mis. FE :3200 + BE :4200:
//   SCREENS_ORIGIN=http://localhost:3200 SCREENS_OUT=<folder> npx playwright test -c playwright.screens.config.ts
// Opsional SCREENS_PAGES="/,/profil" untuk membatasi halaman.
export default defineConfig({
  testDir: "./e2e",
  testMatch: "screens.spec.ts",
  workers: 1,
  reporter: "list",
  timeout: 300_000,
  expect: { timeout: 15_000 },
  use: { locale: "id-ID", baseURL: process.env.SCREENS_ORIGIN },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
