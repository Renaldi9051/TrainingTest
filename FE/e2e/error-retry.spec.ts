import http from "node:http";
import { expect, test } from "@playwright/test";

// Tombol "Coba lagi" di halaman error publik harus mengambil ulang data dari server: BE mati saat
// pengunjung pindah halaman (mis. container dibangun ulang), lalu hidup lagi, dan "Coba lagi" memuat
// halaman tanpa reload manual. BE dimatikan/dinyalakan lewat proxy yang dikendalikan test ini, jadi
// butuh FE yang sudah hidup dengan BE_INTERNAL_URL mengarah ke proxy itu, contoh:
//   BE_INTERNAL_URL=http://127.0.0.1:4200 npx dotenv -e ../.env -- next dev -p 3200
//   RETRY_ORIGIN=http://localhost:3200 RETRY_PROXY_PORT=4200 RETRY_BE_PORT=4000 \
//     npx playwright test e2e/error-retry.spec.ts
const ORIGIN = process.env.RETRY_ORIGIN ?? "";
const PROXY_PORT = Number(process.env.RETRY_PROXY_PORT ?? 4200);
const BE_PORT = Number(process.env.RETRY_BE_PORT ?? 4000);
const CATEGORY = process.env.RETRY_CATEGORY ?? "accounting";

let proxy: http.Server | null = null;

function startBe(): Promise<void> {
  return new Promise((resolve) => {
    proxy = http
      .createServer((req, res) => {
        const upstream = http.request(
          { host: "127.0.0.1", port: BE_PORT, path: req.url, method: req.method, headers: req.headers },
          (response) => {
            res.writeHead(response.statusCode ?? 502, response.headers);
            response.pipe(res);
          },
        );
        upstream.on("error", () => {
          res.writeHead(502);
          res.end();
        });
        req.pipe(upstream);
      })
      .listen(PROXY_PORT, resolve);
  });
}

function stopBe(): Promise<void> {
  return new Promise((resolve) => {
    if (!proxy) return resolve();
    proxy.closeAllConnections();
    proxy.close(() => resolve());
    proxy = null;
  });
}

test.describe("halaman error publik @manual", () => {
  test.skip(!ORIGIN, "Butuh RETRY_ORIGIN (FE yang BE_INTERNAL_URL-nya ke proxy RETRY_PROXY_PORT).");
  test.afterEach(stopBe);

  test("Coba lagi memuat ulang data setelah BE pulih", async ({ page }) => {
    test.setTimeout(240_000);
    await startBe();
    await page.goto(`${ORIGIN}/pelatihan/kategori/${CATEGORY}`, { waitUntil: "networkidle", timeout: 180_000 });
    const link = page.locator('a[href^="/pelatihan/training-"]').first();
    const href = await link.getAttribute("href");

    await stopBe();
    await link.click();
    await expect(page.getByRole("heading", { name: "Halaman tidak dapat dimuat" })).toBeVisible({ timeout: 120_000 });

    await startBe();
    await page.getByRole("button", { name: "Coba lagi" }).click();
    await expect(page.getByRole("heading", { name: "Halaman tidak dapat dimuat" })).toBeHidden({ timeout: 120_000 });
    await expect(page).toHaveURL(new RegExp(`${href}$`));
  });
});
