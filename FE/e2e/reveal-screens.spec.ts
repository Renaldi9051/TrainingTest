import { mkdirSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

// Screenshot manual 360/768/1280 px untuk cek visual reveal Fase 4.1b (bukan bagian suite biasa).
// Jalankan terhadap server yang sudah hidup, mis. build produksi di :3101:
//   SCREENS_ORIGIN=http://localhost:3101 npx playwright test e2e/reveal-screens.spec.ts --grep @manual
// Per halaman: layar pertama (hero tanpa scroll) dan halaman penuh setelah digulir sampai bawah,
// supaya semua grup reveal sudah selesai diputar sebelum difoto.

const ORIGIN = process.env.SCREENS_ORIGIN ?? "";
const OUT = path.join(__dirname, "..", "test-results", "screens-reveal");
const PAGES = ["/", "/pelatihan", "/jadwal", "/layanan", "/profil", "/profil/portofolio"];
const WIDTHS = [360, 768, 1280];

test.describe("screenshot reveal @manual", () => {
  test.skip(!ORIGIN, "Butuh SCREENS_ORIGIN (server yang sudah hidup).");
  test.use({ baseURL: ORIGIN });

  for (const width of WIDTHS) {
    test(`${width} px`, async ({ page }) => {
      test.setTimeout(180_000);
      mkdirSync(OUT, { recursive: true });
      await page.setViewportSize({ width, height: 800 });
      for (const route of PAGES) {
        const name = route === "/" ? "beranda" : route.slice(1).replaceAll("/", "-");
        await page.goto(route);
        await expect(page.locator("h1").first()).toBeVisible();
        // Headline hero CSS selesai <= 500 ms.
        await page.waitForTimeout(700);
        await page.screenshot({ path: path.join(OUT, `${name}-${width}-layar1.png`) });
        // Gulir bertahap seperti pengguna supaya tiap grup reveal masuk viewport dan diputar.
        const height = await page.evaluate(() => document.documentElement.scrollHeight);
        for (let y = 0; y < height; y += 400) {
          await page.mouse.wheel(0, 400);
          await page.waitForTimeout(120);
        }
        await page.waitForTimeout(1_800);
        const hidden = await page.evaluate(
          () =>
            [...document.querySelectorAll<HTMLElement>("[data-reveal-root], [data-reveal-root] [style]")].filter((element) => {
              const { opacity, transform, clipPath } = element.style;
              return (opacity !== "" && opacity !== "1") || (transform !== "" && transform !== "none") || (clipPath !== "" && !clipPath.startsWith("inset(0"));
            }).length,
        );
        // Setelah digulir sampai bawah, tidak boleh ada elemen yang tertinggal tersembunyi.
        expect(hidden, `${route} @ ${width}px`).toBe(0);
        await page.screenshot({ path: path.join(OUT, `${name}-${width}-penuh.png`), fullPage: true });
      }
    });
  }
});
