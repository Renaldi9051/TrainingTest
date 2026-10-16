import { mkdirSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

// Screenshot halaman publik di 360/768/1280 px untuk dibandingkan dengan mockup design-reference/
// (redesign v0.2). Hanya lewat playwright.screens.config.ts (server sudah hidup, tanpa reset DB);
// suite e2e biasa mengabaikan file ini. Per halaman: layar pertama dan halaman penuh setelah
// digulir sampai bawah (semua reveal selesai). Nama file: <halaman>-<lebar>-<layar1|penuh>.png.

const ORIGIN = process.env.SCREENS_ORIGIN ?? "";
const OUT = process.env.SCREENS_OUT ?? path.join(__dirname, "..", "test-results", "screens");
const DEFAULT_PAGES = ["/", "/profil", "/profil/portofolio", "/layanan", "/pelatihan", "/jadwal", "/kontak"];
const PAGES = process.env.SCREENS_PAGES ? process.env.SCREENS_PAGES.split(",").map((value) => value.trim()) : DEFAULT_PAGES;
const WIDTHS = [360, 768, 1280];

function fileName(route: string): string {
  return route === "/" ? "beranda" : route.slice(1).replace(/[/?=&]+/g, "-");
}

// Interaksi shell (fase 2): overlay indeks A-Z dari header, dropdown submenu, menu mobile.
test.describe("screenshot interaksi shell @manual", () => {
  test.skip(!ORIGIN, "Butuh SCREENS_ORIGIN (server yang sudah hidup).");

  test("overlay indeks A-Z: buka, saring, Esc, fokus kembali", async ({ page }) => {
    mkdirSync(OUT, { recursive: true });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/profil");
    const trigger = page.getByRole("navigation", { name: "Menu utama" }).getByRole("button", { name: /^Indeks / });
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "Indeks kategori / A-Z" });
    await expect(dialog).toBeVisible();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(OUT, "overlay-1280.png") });
    await dialog.getByRole("searchbox", { name: "Saring kategori" }).fill("drone");
    await page.screenshot({ path: path.join(OUT, "overlay-saring-1280.png") });
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  // Simulasi hero (sebelum HeroSlideshow ada): penanda [data-header-over] disisipkan setelah halaman
  // tenang (di akhir body; isi main bisa dirender ulang React saat streaming selesai), lalu main diberi
  // latar gelap di bagian atas. Header harus transparan berteks terang & tidak sticky, floating
  // contact tersembunyi.
  test("header di atas hero (simulasi) dan floating contact tersembunyi", async ({ page }) => {
    mkdirSync(OUT, { recursive: true });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/profil", { waitUntil: "networkidle" });
    await page.evaluate(() => {
      const marker = document.createElement("div");
      marker.setAttribute("data-header-over", "");
      document.body.append(marker);
      const main = document.querySelector("main");
      if (main) main.style.background = "linear-gradient(var(--inverse-bg) 0 600px, transparent 600px)";
    });
    const header = page.locator("header.site-header");
    await expect(header).toHaveCSS("position", "absolute");
    await expect(header).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await expect(page.locator(".floating-contact")).toBeHidden();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(OUT, "header-hero-simulasi-1280.png"), clip: { x: 0, y: 0, width: 1280, height: 400 } });
  });

  test("dropdown submenu dan menu mobile", async ({ page }) => {
    mkdirSync(OUT, { recursive: true });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/profil");
    await page.getByRole("navigation", { name: "Menu utama" }).getByRole("button", { name: /^Submenu Layanan/ }).click();
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(OUT, "dropdown-1280.png"), clip: { x: 0, y: 0, width: 1280, height: 400 } });

    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto("/profil");
    await page.getByRole("button", { name: "Buka menu" }).click();
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(OUT, "menu-mobile-360.png") });
    await page.getByRole("navigation", { name: "Menu utama (mobile)" }).getByRole("button", { name: /^Indeks / }).click();
    await expect(page.getByRole("dialog", { name: "Indeks kategori / A-Z" })).toBeVisible();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(OUT, "overlay-360.png") });
  });

  // Fase 4: overlay indeks kategori dari sidebar filter katalog (mobile: di dalam panel terlipat).
  test("katalog: overlay indeks kategori A-Z", async ({ page }) => {
    mkdirSync(OUT, { recursive: true });
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/pelatihan");
      if (width < 1024) await page.locator("summary", { hasText: "Filter" }).click();
      await page.getByRole("button", { name: /^Tampilkan semua kategori/ }).click();
      await expect(page.getByRole("dialog", { name: "Indeks kategori / A-Z" })).toBeVisible();
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(OUT, `katalog-az-${width}.png`) });
    }
  });
});

test.describe("screenshot redesign @manual", () => {
  test.skip(!ORIGIN, "Butuh SCREENS_ORIGIN (server yang sudah hidup).");

  for (const width of WIDTHS) {
    test(`${width} px`, async ({ page }) => {
      mkdirSync(OUT, { recursive: true });
      // Error JS di halaman ikut dilaporkan (halaman bisa jatuh ke error boundary tanpa h1).
      page.on("pageerror", (error) => console.log(`[pageerror] ${page.url()} ${error.message}`));
      page.on("console", (message) => {
        if (message.type() === "error") console.log(`[console] ${page.url()} ${message.text()}`);
      });
      await page.setViewportSize({ width, height: 800 });
      for (const route of PAGES) {
        const name = fileName(route);
        await page.goto(route);
        await expect(page.locator("h1").first()).toBeAttached();
        // Headline hero CSS selesai <= 500 ms.
        await page.waitForTimeout(800);
        await page.screenshot({ path: path.join(OUT, `${name}-${width}-layar1.png`) });
        // Gulir bertahap seperti pengguna supaya tiap grup reveal masuk viewport dan diputar.
        const height = await page.evaluate(() => document.documentElement.scrollHeight);
        for (let y = 0; y < height; y += 400) {
          await page.mouse.wheel(0, 400);
          await page.waitForTimeout(100);
        }
        await page.waitForTimeout(1_500);
        await page.screenshot({ path: path.join(OUT, `${name}-${width}-penuh.png`), fullPage: true });
        // SCREENS_SECTIONS=1: juga satu gambar per section (lebih mudah diperiksa daripada halaman penuh).
        if (process.env.SCREENS_SECTIONS === "1") {
          const sections = page.locator("main > section, main > div > section, main > div > div[aria-hidden]");
          const total = await sections.count();
          for (let index = 0; index < total; index += 1) {
            await sections.nth(index).screenshot({ path: path.join(OUT, `${name}-${width}-section-${String(index + 1).padStart(2, "0")}.png`) });
          }
        }
      }
    });
  }
});
