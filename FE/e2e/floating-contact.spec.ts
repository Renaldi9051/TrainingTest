import { mkdirSync } from "node:fs";
import path from "node:path";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { createTraining, deleteTraining, firstCategory, loginViaApi, ORIGIN, runId, type CreatedTraining } from "./helpers";

// Floating contact (4.5): tombol bulat + panel marketing (Popover API native), pesan WA mengikuti
// halaman detail, bar CTA mobile di detail pelatihan membuka panel yang sama, fallback ke /kontak
// tanpa dukungan popover. Kontak marketing yang sudah aktif dinonaktifkan selama uji lalu
// dipulihkan; data uji berawalan [UJI].

const HEADERS = { Origin: ORIGIN };
type Marketing = { id: string; name: string; active: boolean };

const trigger = (page: Page) => page.getByRole("button", { name: "Hubungi marketing" });
const fallback = (page: Page) => page.getByRole("link", { name: "Hubungi marketing" });
const panel = (page: Page) => page.getByRole("dialog", { name: "Hubungi marketing" });
const chatLinks = (page: Page) => panel(page).getByRole("link", { name: /^Chat WA/ });
const waText = async (page: Page, index: number) =>
  new URL((await chatLinks(page).nth(index).getAttribute("href")) ?? "").searchParams.get("text");

async function setActive(request: APIRequestContext, id: string, active: boolean) {
  const response = await request.patch(`/api/admin/marketing/${id}`, { headers: HEADERS, data: { active } });
  expect(response.status(), await response.text()).toBe(200);
}

// Halaman publik di-cache; setelah mutasi admin, muat ulang sampai perubahan tampil.
async function gotoUntil(page: Page, url: string, check: () => Promise<void>) {
  await expect(async () => {
    await page.goto(url);
    await check();
  }).toPass({ timeout: 15_000 });
}

// Buka panel lewat tombol, tunggu pesan WA disesuaikan (FloatingContactSync aktif setelah hidrasi).
async function openPanelUntil(page: Page, open: () => Promise<void>, check: () => Promise<void>) {
  await expect(async () => {
    if (await panel(page).isVisible()) await page.keyboard.press("Escape");
    await open();
    await expect(panel(page)).toBeVisible({ timeout: 1_000 });
    await check();
  }).toPass({ timeout: 15_000 });
}

test.describe.configure({ mode: "serial" });
test.describe("floating contact", () => {
  const id = runId();
  const deactivated: string[] = [];
  const createdContacts: string[] = [];
  let training: CreatedTraining;
  let serviceId = "";
  let serviceSlug = "";
  const serviceTitle = `[UJI] Layanan kontak ${id}`;
  const sari = `[UJI] Sari ${id}`;
  const budi = `[UJI] Budi ${id}`;

  test.beforeAll(async ({ request }) => {
    await loginViaApi(request);
    const response = await request.get("/api/admin/marketing?active=true&pageSize=100");
    const { data } = (await response.json()) as { data: Marketing[] };
    for (const contact of data) {
      await setActive(request, contact.id, false);
      deactivated.push(contact.id);
    }
    const category = await firstCategory(request);
    training = await createTraining(request, { title: `[UJI] Kontak pelatihan ${id}`, categoryIds: [category.id], status: "PUBLISHED" });
    const service = await request.post("/api/admin/services", { headers: HEADERS, data: { title: serviceTitle, status: "PUBLISHED" } });
    expect(service.status(), await service.text()).toBe(201);
    ({ id: serviceId, slug: serviceSlug } = ((await service.json()) as { data: { id: string; slug: string } }).data);
  });

  test.afterAll(async ({ request }) => {
    // Konteks request tiap hook/tes terpisah: login lagi.
    await loginViaApi(request);
    for (const contactId of createdContacts) await request.delete(`/api/admin/marketing/${contactId}`, { headers: HEADERS });
    for (const contactId of deactivated) await setActive(request, contactId, true);
    await deleteTraining(request, training.id);
    if (serviceId) await request.delete(`/api/admin/services/${serviceId}`, { headers: HEADERS });
  });

  test("tanpa kontak marketing: tombol bulat tidak dirender", async ({ page }) => {
    await gotoUntil(page, "/", async () => {
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(trigger(page)).toHaveCount(0);
      await expect(fallback(page)).toHaveCount(0);
    });
    // Bar CTA mobile di detail pelatihan tetap tautan WA langsung (nomor dari pengaturan).
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto(`/pelatihan/${training.slug}`);
    const barChat = page.getByRole("link", { name: "Chat WA" }).last();
    await expect(barChat).toBeVisible();
    await expect(barChat).toHaveAttribute("href", /^https:\/\/wa\.me\//);
  });

  test("Esc menutup, fokus masuk ke kontak pertama lalu kembali ke tombol; pesan default", async ({ page, request }) => {
    await loginViaApi(request);
    for (const data of [
      { name: sari, phone: "6281200000901", defaultMessage: "Halo, saya mau tanya program in-house." },
      { name: budi, phone: "6281200000902", defaultMessage: null },
    ]) {
      const response = await request.post("/api/admin/marketing", { headers: HEADERS, data });
      expect(response.status(), await response.text()).toBe(201);
      createdContacts.push(((await response.json()) as { data: Marketing }).data.id);
    }

    await gotoUntil(page, "/", () => expect(trigger(page)).toBeVisible({ timeout: 2_000 }));
    await expect(trigger(page)).toHaveAttribute("popovertarget", "kontak-marketing");
    await expect(fallback(page)).toBeHidden();
    await expect(panel(page)).toBeHidden();

    await trigger(page).click();
    await expect(panel(page)).toBeVisible();
    await expect(chatLinks(page)).toHaveCount(2);
    await expect(chatLinks(page).first()).toBeFocused();
    await expect(chatLinks(page).first()).toHaveAttribute("target", "_blank");
    await expect(panel(page)).toContainText("+6281200000901");
    expect(await waText(page, 0)).toBe("Halo, saya mau tanya program in-house.");
    expect(await waText(page, 1)).toBe(`Halo ${budi}, saya ingin bertanya.`);

    await page.keyboard.press("Escape");
    await expect(panel(page)).toBeHidden();
    await expect(trigger(page)).toBeFocused();

    // Keyboard saja: Enter membuka, tombol Tutup menutup.
    await page.keyboard.press("Enter");
    await expect(panel(page)).toBeVisible();
    await panel(page).getByRole("button", { name: "Tutup" }).click();
    await expect(panel(page)).toBeHidden();
  });

  test("desktop, detail pelatihan & layanan: pesan WA berisi judul dan nama marketing", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`/pelatihan/${training.slug}`);
    await openPanelUntil(page, () => trigger(page).click(), async () => {
      expect(await waText(page, 0)).toBe(`Halo ${sari}, saya tertarik dengan pelatihan "${training.title}". Mohon info jadwal dan investasinya.`);
    });
    expect(await waText(page, 1)).toContain(`Halo ${budi}, saya tertarik dengan pelatihan "${training.title}"`);
    // Popover di atas tombol bulat, tidak menutupinya.
    await expect(panel(page)).toHaveCSS("transform", "none");
    const panelBox = await panel(page).boundingBox();
    const buttonBox = await trigger(page).boundingBox();
    expect(panelBox && buttonBox && panelBox.y + panelBox.height <= buttonBox.y).toBeTruthy();
    await page.keyboard.press("Escape");

    // Navigasi klien ke halaman lain: pesan kembali ke default (topik dibaca saat panel dibuka).
    await page.locator('footer a[href="/kontak"]').first().click();
    await expect(page).toHaveURL(/\/kontak$/);
    await openPanelUntil(page, () => trigger(page).click(), async () => {
      expect(await waText(page, 0)).toBe("Halo, saya mau tanya program in-house.");
    });
    await page.keyboard.press("Escape");

    await page.goto(`/layanan/${serviceSlug}`);
    await openPanelUntil(page, () => trigger(page).click(), async () => {
      expect(await waText(page, 0)).toBe(`Halo ${sari}, saya ingin konsultasi tentang layanan "${serviceTitle}".`);
    });
  });

  test("mobile, detail pelatihan: tombol bulat disembunyikan, 'Chat WA' di bar membuka panel yang sama", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto("/");
    await expect(trigger(page)).toBeVisible();

    await page.goto(`/pelatihan/${training.slug}`);
    await expect(trigger(page)).toBeHidden();
    const barChat = page.getByRole("button", { name: "Chat WA" });
    await expect(barChat).toBeVisible();
    await expect(barChat).toHaveAttribute("popovertarget", "kontak-marketing");
    await openPanelUntil(page, () => barChat.click(), async () => {
      expect(await waText(page, 0)).toContain(`"${training.title}"`);
    });
    // Sheet dari bawah selebar layar (diukur setelah transisi masuk selesai).
    await expect(panel(page)).toHaveCSS("transform", "none");
    const box = await panel(page).boundingBox();
    expect(box?.width).toBe(390);
    expect(Math.round((box?.y ?? 0) + (box?.height ?? 0))).toBe(800);
    await page.keyboard.press("Escape");
    await expect(panel(page)).toBeHidden();
    await expect(barChat).toBeFocused();

    // Navigasi klien keluar dari detail (halaman lama tetap ada di DOM tersembunyi): tombol bulat
    // tampil lagi dan pesan kembali ke default.
    await page.locator('footer a[href="/kontak"]').first().dispatchEvent("click");
    await expect(page).toHaveURL(/\/kontak$/);
    await expect(trigger(page)).toBeVisible();
    await openPanelUntil(page, () => trigger(page).click(), async () => {
      expect(await waText(page, 0)).toBe("Halo, saya mau tanya program in-house.");
    });
  });

  test("tanpa dukungan Popover API: tombol bulat & 'Chat WA' di bar menuju daftar marketing di /kontak", async ({ page }) => {
    await page.addInitScript(() => {
      for (const key of ["popover", "showPopover", "hidePopover", "togglePopover"]) {
        Reflect.deleteProperty(HTMLElement.prototype, key);
      }
    });
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto(`/pelatihan/${training.slug}`);
    const barChat = page.getByRole("link", { name: "Chat WA" });
    // Setelah hidrasi, html[data-popover="off"]: tombol diganti tautan.
    await expect(page.locator("html")).toHaveAttribute("data-popover", "off");
    await expect(barChat).toBeVisible();
    await expect(barChat).toHaveAttribute("href", "/kontak#tim-marketing");
    await expect(page.getByRole("button", { name: "Chat WA" })).toBeHidden();

    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(trigger(page)).toBeHidden();
    await expect(fallback(page)).toBeVisible();
    await fallback(page).click();
    await expect(page).toHaveURL(/\/kontak#tim-marketing$/);
    await expect(page.locator("#tim-marketing")).toBeInViewport();
    await expect(page.locator("#tim-marketing")).toContainText(sari);
  });

  test("reduced motion: panel langsung tampil tanpa transisi", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await trigger(page).click();
    await expect(panel(page)).toBeVisible();
    const durations = await panel(page).evaluate((element) => getComputedStyle(element).transitionDuration.split(",").map(parseFloat));
    for (const duration of durations) expect(duration).toBeLessThan(0.001);
    await expect(panel(page)).toHaveCSS("opacity", "1");
  });

  test("screenshot panel 360/768/1280 px @screens", async ({ page }) => {
    const dir = path.join(__dirname, "..", "test-results", "screens");
    mkdirSync(dir, { recursive: true });
    for (const width of [360, 768, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/");
      await page.screenshot({ path: path.join(dir, `contact-button-${width}.png`) });
      await trigger(page).click();
      await expect(panel(page)).toHaveCSS("transform", "none");
      await page.screenshot({ path: path.join(dir, `contact-panel-${width}.png`) });
    }
    // Tombol bulat di atas footer hitam.
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" }));
    await expect(trigger(page)).toBeInViewport();
    await page.screenshot({ path: path.join(dir, "contact-button-footer-1280.png") });
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(`/pelatihan/${training.slug}`);
    await expect(page.getByRole("button", { name: "Chat WA" })).toHaveCSS("opacity", "1");
    await page.screenshot({ path: path.join(dir, "contact-training-bar-360.png") });
  });
});
