import { devices, expect, test } from "@playwright/test";
import { ORIGIN } from "./helpers";

// Menu header dengan submenu (Profil, Layanan): split button. Label = link ke halaman induk,
// tombol panah terpisah (min 24x24 px) membuka submenu yang hanya berisi item dari CMS.
// Menu dari seed e2e: Profil -> Portofolio.
const INDICATOR = 'nav[aria-label="Menu utama"] > [data-active-indicator]';

test.describe("menu header: split button submenu", () => {
  test("label membuka halaman induk; panah membuka submenu tanpa item 'Semua ...'", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/jadwal");
    const nav = page.getByRole("navigation", { name: "Menu utama" });
    const toggle = nav.getByRole("button", { name: "Submenu Profil" });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    const size = await toggle.boundingBox();
    expect(size?.width).toBeGreaterThanOrEqual(24);
    expect(size?.height).toBeGreaterThanOrEqual(24);

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    const panel = page.locator(`#${await toggle.getAttribute("aria-controls")}`);
    await expect(panel.getByRole("link")).toHaveText(["Portofolio"]);
    await expect(panel.getByText(/^Semua /)).toHaveCount(0);
    await page.mouse.click(5, 400);
    await expect(toggle).toHaveAttribute("aria-expanded", "false");

    await nav.getByRole("link", { name: "Profil", exact: true }).click();
    await page.waitForURL(/\/profil$/);
    await expect(nav.getByRole("link", { name: "Profil", exact: true })).toHaveAttribute("aria-current", "page");
  });

  test("keyboard: Tab ke panah, Enter membuka, Tab ke item, Esc menutup dan fokus kembali ke panah", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/jadwal");
    const nav = page.getByRole("navigation", { name: "Menu utama" });
    const toggle = nav.getByRole("button", { name: "Submenu Profil" });
    await nav.getByRole("link", { name: "Profil", exact: true }).focus();
    await page.keyboard.press("Tab");
    await expect(toggle).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Portofolio" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(toggle).toBeFocused();

    // Space juga membuka; Enter di item submenu menavigasi dan menutup submenu.
    await page.keyboard.press("Space");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");
    await page.waitForURL(/\/profil\/portofolio$/);
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    // Halaman anak: label induk tetap aktif dan indikator berada di bawahnya.
    const parent = nav.getByRole("link", { name: "Profil", exact: true });
    await expect(parent).toHaveAttribute("aria-current", "page");
    await expect
      .poll(async () => {
        const [mark, link] = await Promise.all([page.locator(INDICATOR).boundingBox(), parent.boundingBox()]);
        return mark && link ? Math.abs(mark.x - link.x) < 1 && Math.abs(mark.width - link.width) < 1 : false;
      })
      .toBe(true);
  });

  test("mobile: menu layar penuh memuat link induk dan item submenu", async ({ browser }) => {
    const context = await browser.newContext({ ...devices["Pixel 7"], baseURL: ORIGIN, locale: "id-ID" });
    const page = await context.newPage();
    await page.goto("/jadwal");
    await page.getByRole("button", { name: "Buka menu" }).click();
    const mobile = page.getByRole("navigation", { name: "Menu utama (mobile)" });
    await expect(mobile.getByRole("link", { name: "Profil", exact: true })).toBeVisible();
    await expect(mobile.getByRole("link", { name: "Portofolio" })).toBeVisible();
    await mobile.getByRole("link", { name: "Profil", exact: true }).click();
    await page.waitForURL(/\/profil$/);
    await context.close();
  });
});
