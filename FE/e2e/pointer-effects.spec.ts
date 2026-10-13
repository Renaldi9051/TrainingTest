import { readFile } from "node:fs/promises";
import path from "node:path";
import { devices, expect, test, type Page } from "@playwright/test";
import { loginViaApi, ORIGIN, runId } from "./helpers";

// Efek kursor & indikator aktif (Fase 4.1c): magnetic + roll text di CTA besar, label "Lihat →" di
// kartu pelatihan, gambar layanan ikut kursor, indikator aktif FLIP di chip filter, urutan, dan
// menu header. Semua mati di perangkat tanpa hover dan saat reduced motion; konten tetap bisa
// diakses dengan keyboard. Konten uji dibuat lewat API di database e2e, berawalan [UJI].

const HEADERS = { Origin: ORIGIN };
const MAX_PX = 6;
const NOT_FOUND = "/halaman-uji-tidak-ada";
// Menu header aktif tingkat atas: link biasa atau link label di split button submenu.
const TOP_MENU_ACTIVE =
  'nav[aria-label="Menu utama"] > ul > li > a[aria-current], nav[aria-label="Menu utama"] > ul > li > div > a[aria-current]';

declare global {
  interface Window {
    __indicatorAnimations: number;
  }
}

// Hitung animasi WAAPI pada elemen indikator (motion/mini memakai Element.animate).
function countIndicatorAnimations(page: Page) {
  return page.addInitScript(() => {
    window.__indicatorAnimations = 0;
    const original = Element.prototype.animate;
    Element.prototype.animate = function (...args: Parameters<Element["animate"]>) {
      if (this instanceof HTMLElement && this.dataset.activeIndicator) window.__indicatorAnimations += 1;
      return original.apply(this, args);
    };
  });
}

const indicatorAnimations = (page: Page) => page.evaluate(() => window.__indicatorAnimations);

async function box(page: Page, selector: string) {
  const handle = page.locator(selector).first();
  const rect = await handle.boundingBox();
  if (!rect) throw new Error(`${selector} tidak terlihat`);
  return rect;
}

// Indikator berada tepat di elemen aktif (pill) atau garis 1 px di bawahnya (line).
async function expectIndicatorOn(page: Page, indicator: string, target: string, variant: "pill" | "line") {
  await expect
    .poll(async () => {
      const [mark, active] = await Promise.all([box(page, indicator), box(page, target)]);
      const top = variant === "pill" ? active.y : active.y + active.height;
      const height = variant === "pill" ? active.height : 1;
      return [mark.x - active.x, mark.y - top, mark.width - active.width, mark.height - height].every((delta) => Math.abs(delta) < 1);
    })
    .toBe(true);
}

const magneticTransform = (page: Page, name: string) =>
  page.getByRole("link", { name, exact: true }).evaluate((element) => (element as HTMLElement).style.transform);

function parseTranslate(transform: string): [number, number] | null {
  const match = /^translate\((-?[\d.]+)px, (-?[\d.]+)px\)$/.exec(transform);
  return match ? [Number(match[1]), Number(match[2])] : null;
}

test.describe("efek kursor & indikator aktif", () => {
  const id = runId();
  let serviceId = "";
  let mediaId = "";
  let imageUrlPart = "";

  test.beforeAll(async ({ request }) => {
    await loginViaApi(request);
    const buffer = await readFile(path.join(__dirname, "fixtures", "sample.png"));
    const upload = await request.post("/api/admin/media", {
      headers: HEADERS,
      multipart: { files: { name: `[UJI]-kursor-${id}.png`, mimeType: "image/png", buffer }, folder: "uji" },
    });
    expect(upload.status(), await upload.text()).toBe(201);
    mediaId = ((await upload.json()) as { data: { created: { id: string }[] } }).data.created[0].id;
    expect((await request.patch(`/api/admin/media/${mediaId}`, { headers: HEADERS, data: { alt: "[UJI] Gambar layanan" } })).status()).toBe(200);
    const created = await request.post("/api/admin/services", {
      headers: HEADERS,
      data: { title: `[UJI] Layanan kursor ${id}`, summary: "Layanan uji untuk gambar ikut kursor.", imageId: mediaId, status: "PUBLISHED" },
    });
    expect(created.status(), await created.text()).toBe(201);
    serviceId = ((await created.json()) as { data: { id: string } }).data.id;
    await expect.poll(async () => (await (await request.get("/layanan")).text()).includes(`Layanan kursor ${id}`)).toBe(true);
    const media = await request.get(`/api/admin/media/${mediaId}`);
    const url = ((await media.json()) as { data: { url: string } }).data.url;
    // Nama file tanpa ekstensi: cocok dengan URL varian mana pun.
    imageUrlPart = path.basename(url).replace(/\.[^.]+$/, "").replace(/-\d+$/, "");
  });

  test.afterAll(async ({ request }) => {
    await loginViaApi(request);
    if (serviceId) await request.delete(`/api/admin/services/${serviceId}`, { headers: HEADERS });
    if (mediaId) await request.delete(`/api/admin/media/${mediaId}`, { headers: HEADERS });
  });

  test("CTA besar: magnetic maksimal 6 px, kembali saat kursor pergi; teks roll dengan nama aksesibel tunggal", async ({ page }) => {
    await page.goto(NOT_FOUND);
    const cta = page.getByRole("link", { name: "Lihat katalog pelatihan", exact: true });
    await expect(cta).toBeVisible();
    const rect = await cta.boundingBox();
    if (!rect) throw new Error("CTA tidak terlihat");

    // Pojok kanan bawah: geser ke arah kursor, tidak lebih dari 6 px.
    await page.mouse.move(rect.x + rect.width - 2, rect.y + rect.height - 2, { steps: 5 });
    await expect.poll(async () => parseTranslate(await magneticTransform(page, "Lihat katalog pelatihan"))?.[0] ?? 0).toBeGreaterThan(0);
    const [x, y] = parseTranslate(await magneticTransform(page, "Lihat katalog pelatihan")) ?? [0, 0];
    expect(Math.abs(x)).toBeLessThanOrEqual(MAX_PX);
    expect(Math.abs(y)).toBeLessThanOrEqual(MAX_PX);
    expect(y).toBeGreaterThan(0);

    // Roll: teks asli naik keluar mask, duplikatnya (aria-hidden) naik menggantikan.
    const [original, duplicate] = [cta.locator("[data-roll] > span").first(), cta.locator("[data-roll] > span[aria-hidden]")];
    await expect.poll(() => original.evaluate((element) => getComputedStyle(element).translate)).toMatch(/^0px -\d/);
    await expect.poll(() => duplicate.evaluate((element) => getComputedStyle(element).translate)).toMatch(/^(none|0px|0px 0px)$/);

    await page.mouse.move(5, 5, { steps: 3 });
    await expect.poll(() => magneticTransform(page, "Lihat katalog pelatihan")).toBe("");
    // Kursor sistem tetap tampil (DESIGN.md 8.3).
    expect(await cta.evaluate((element) => getComputedStyle(element).cursor)).toBe("pointer");
  });

  test("kartu pelatihan: label Lihat ikut kursor tanpa mengganti kursor sistem", async ({ page }) => {
    await page.goto("/pelatihan");
    const card = page.locator("article[data-cursor-label]").first();
    await expect(card).toBeVisible();
    const float = page.locator("[data-cursor-label-float]");
    await expect(float).toHaveAttribute("aria-hidden", "true");
    await card.hover();
    await expect(float).toHaveAttribute("data-active", "");
    await expect(float).toHaveText("Lihat →");
    // Label tepat di kanan bawah ujung kursor, tidak menutupinya.
    const cardBox = await card.boundingBox();
    const floatBox = await float.boundingBox();
    if (!cardBox || !floatBox) throw new Error("kartu/label tidak terlihat");
    expect(floatBox.x).toBeGreaterThan(cardBox.x + cardBox.width / 2);
    expect(floatBox.y).toBeGreaterThan(cardBox.y + cardBox.height / 2);
    expect(await card.getByRole("link").evaluate((element) => getComputedStyle(element).cursor)).toBe("pointer");

    await page.mouse.move(2, 2);
    await expect(float).not.toHaveAttribute("data-active", "");
  });

  test("baris layanan: gambar ikut kursor di desktop", async ({ page }) => {
    await page.goto("/layanan");
    const row = page.locator("li[data-cursor-image]", { hasText: `Layanan kursor ${id}` });
    const follow = row.locator("[data-cursor-follow]");
    await expect(follow).toHaveAttribute("aria-hidden", "true");
    await row.scrollIntoViewIfNeeded();
    await row.hover({ position: { x: 40, y: 20 } });
    await expect(follow).toHaveAttribute("data-active", "");
    await expect.poll(() => follow.evaluate((element) => getComputedStyle(element).opacity)).toBe("1");
    await expect.poll(() => follow.locator("img").evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    const first = await follow.evaluate((element) => element.style.transform);
    await row.hover({ position: { x: 200, y: 30 } });
    await expect.poll(() => follow.evaluate((element) => element.style.transform)).not.toBe(first);

    await page.mouse.move(2, 2);
    await expect(follow).not.toHaveAttribute("data-active", "");
  });

  test("perangkat sentuh (tanpa hover): tanpa efek kursor dan gambar layanan tidak diunduh", async ({ browser }) => {
    const context = await browser.newContext({ ...devices["Pixel 7"], baseURL: ORIGIN, locale: "id-ID" });
    const page = await context.newPage();
    const imageRequests: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes(imageUrlPart)) imageRequests.push(request.url());
    });
    await page.goto("/layanan");
    const row = page.locator("li[data-cursor-image]", { hasText: `Layanan kursor ${id}` });
    await row.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await expect(row.locator("[data-cursor-follow]")).toBeHidden();
    await expect(page.locator("[data-cursor-label-float]")).toHaveCount(0);
    expect(imageRequests).toEqual([]);
    await context.close();
  });

  test("reduced motion: tanpa magnetic, label, maupun animasi indikator", async ({ browser }) => {
    const context = await browser.newContext({ ...devices["Desktop Chrome"], baseURL: ORIGIN, locale: "id-ID", reducedMotion: "reduce" });
    const page = await context.newPage();
    await countIndicatorAnimations(page);
    await page.goto(NOT_FOUND);
    const cta = page.getByRole("link", { name: "Lihat katalog pelatihan", exact: true });
    const rect = await cta.boundingBox();
    if (!rect) throw new Error("CTA tidak terlihat");
    await page.mouse.move(rect.x + rect.width - 2, rect.y + rect.height - 2, { steps: 5 });
    await page.waitForTimeout(400);
    expect(await magneticTransform(page, "Lihat katalog pelatihan")).toBe("");
    expect(await cta.locator("[data-roll] > span").first().evaluate((element) => getComputedStyle(element).translate)).toBe("none");
    await expect(page.locator("[data-cursor-label-float]")).toHaveCount(0);

    // Indikator tetap pindah ke chip baru, tapi tanpa animasi.
    await page.goto("/pelatihan");
    const group = page.getByRole("group", { name: "Metode" });
    await group.getByRole("link", { name: "Online" }).click();
    await page.waitForURL(/metode=online/);
    await expectIndicatorOn(page, '[role=group][aria-label="Metode"] [data-active-indicator]', '[role=group][aria-label="Metode"] [aria-current]', "pill");
    expect(await indicatorAnimations(page)).toBe(0);
    await context.close();
  });

  test("indikator aktif: diam saat muat pertama, bergeser (FLIP) saat chip, urutan, atau menu berubah; bisa lewat keyboard", async ({ page }) => {
    await countIndicatorAnimations(page);
    await page.goto("/pelatihan");
    const metode = '[role=group][aria-label="Metode"]';
    const pill = `${metode} [data-active-indicator]`;
    await expectIndicatorOn(page, pill, `${metode} [aria-current]`, "pill");
    await expectIndicatorOn(page, 'nav[aria-label="Menu utama"] > [data-active-indicator]', TOP_MENU_ACTIVE, "line");
    await page.waitForTimeout(500);
    expect(await indicatorAnimations(page)).toBe(0);
    // Setelah JS siap, latar chip aktif digantikan indikator (tanpa JS chip tetap hitam sendiri).
    await expect(page.locator(`${metode} [data-indicator-ready]`)).toHaveCount(1);
    expect(await page.locator(`${metode} [aria-current]`).evaluate((element) => getComputedStyle(element).backgroundColor)).toBe("rgba(0, 0, 0, 0)");

    // Chip lewat keyboard.
    const online = page.getByRole("group", { name: "Metode" }).getByRole("link", { name: "Online" });
    await online.focus();
    await page.keyboard.press("Enter");
    await page.waitForURL(/metode=online/);
    await expect(online).toHaveAttribute("aria-current", "true");
    await expectIndicatorOn(page, pill, `${metode} [aria-current]`, "pill");
    expect(await indicatorAnimations(page)).toBe(1);

    // Urutan: garis bergeser ke "A-Z".
    const sort = page.getByRole("navigation", { name: "Urutkan" });
    await sort.getByRole("link", { name: "A-Z" }).click();
    await page.waitForURL(/urut=az/);
    await expectIndicatorOn(page, 'nav[aria-label="Urutkan"] [data-active-indicator]', 'nav[aria-label="Urutkan"] [aria-current]', "line");
    expect(await indicatorAnimations(page)).toBe(2);

    // Menu header: pindah halaman (navigasi klien), garis bergeser ke menu baru.
    await page.getByRole("navigation", { name: "Menu utama" }).getByRole("link", { name: "Jadwal Training" }).click();
    await page.waitForURL(/\/jadwal$/);
    await expectIndicatorOn(page, 'nav[aria-label="Menu utama"] > [data-active-indicator]', TOP_MENU_ACTIVE, "line");
    expect(await indicatorAnimations(page)).toBe(3);
  });
});
