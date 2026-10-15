import { expect, test, type Page } from "@playwright/test";

// Pergantian halaman (Fase 4.1d): header halaman ([data-page-enter]) stagger masuk hanya setelah
// navigasi klien ke pathname baru. Muat penuh, Back, perubahan query, dan reduced motion: tanpa
// animasi. Animasi WAAPI pada elemen header dicatat lewat Element.animate.

declare global {
  interface Window {
    __enter: { count: number; maxEnd: number };
  }
}

function watchEnter(page: Page) {
  return page.addInitScript(() => {
    window.__enter = { count: 0, maxEnd: 0 };
    const original = Element.prototype.animate;
    Element.prototype.animate = function (...args: Parameters<Element["animate"]>) {
      if (this instanceof HTMLElement && this.hasAttribute("data-page-enter")) {
        const options = args[1];
        const timing = typeof options === "object" && options ? options : {};
        window.__enter.count += 1;
        window.__enter.maxEnd = Math.max(window.__enter.maxEnd, Number(timing.delay ?? 0) + Number(timing.duration ?? 0));
      }
      return original.apply(this, args);
    };
  });
}

const enter = (page: Page) => page.evaluate(() => window.__enter);
const reset = (page: Page) => page.evaluate(() => (window.__enter = { count: 0, maxEnd: 0 }));
const inlineStyles = (page: Page) =>
  page.evaluate(() => [...document.querySelectorAll<HTMLElement>("#konten [data-page-enter]")].filter((element) => element.getAttribute("style")).length);

test.describe("pergantian halaman: header stagger masuk", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await watchEnter(page);
  });

  test("muat penuh tanpa animasi; klik menu menganimasikan header <= 500 ms lalu final; Back tanpa animasi", async ({ page }) => {
    await page.goto("/pelatihan");
    await expect(page.getByRole("heading", { level: 1, name: "Pelatihan" })).toBeVisible();
    await page.waitForTimeout(600);
    expect((await enter(page)).count).toBe(0);
    expect(await inlineStyles(page)).toBe(0);

    await page.getByRole("navigation", { name: "Menu utama" }).getByRole("link", { name: "Jadwal Training" }).click();
    await page.waitForURL(/\/jadwal$/);
    await expect(page.getByRole("heading", { level: 1, name: "Jadwal pelatihan" })).toBeVisible();
    const after = await enter(page);
    // Eyebrow + h1 di /jadwal.
    expect(after.count).toBeGreaterThanOrEqual(2);
    expect(after.maxEnd).toBeLessThanOrEqual(500);
    await expect.poll(() => inlineStyles(page)).toBe(0);
    // Nama heading utuh (pembaca layar).
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Jadwal pelatihan");

    await reset(page);
    await page.goBack();
    await page.waitForURL(/\/pelatihan$/);
    await expect(page.getByRole("heading", { level: 1, name: "Pelatihan" })).toBeVisible();
    await page.waitForTimeout(600);
    expect((await enter(page)).count).toBe(0);
  });

  test("ganti urutan di katalog (query saja): header tidak beranimasi", async ({ page }) => {
    await page.goto("/pelatihan");
    await page.getByRole("navigation", { name: "Urutkan" }).getByRole("link", { name: "A-Z" }).click();
    await page.waitForURL(/urut=az/);
    await page.waitForTimeout(600);
    expect((await enter(page)).count).toBe(0);
  });

  test("reduced motion: navigasi klien tanpa animasi header", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/pelatihan");
    await page.getByRole("navigation", { name: "Menu utama" }).getByRole("link", { name: "Jadwal Training" }).click();
    await page.waitForURL(/\/jadwal$/);
    await page.waitForTimeout(600);
    expect((await enter(page)).count).toBe(0);
    expect(await inlineStyles(page)).toBe(0);
  });
});
