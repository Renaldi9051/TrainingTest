import { mkdirSync } from "node:fs";
import path from "node:path";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { loginViaApi, ORIGIN, photoLikeJpeg, runId } from "./helpers";

// Hero slideshow beranda (DESIGN.md 8.1, fase 3 redesign v0.2): berganti otomatis, pause/play juga
// menghentikan kata berganti, klik segmen & panah pindah slide, reduced motion tanpa autoplay, header
// transparan di atas foto, floating contact muncul setelah hero lewat. Data uji hanya di database
// training_e2e (3 foto JPEG buatan generator, bukan foto mockup); isi hero dikembalikan di akhir.
// Screenshot 360/768/1280 ke SCREENS_OUT (opsional): SCREENS_OUT=<folder> npx playwright test e2e/hero-slideshow.spec.ts

const HEADERS = { Origin: ORIGIN };
const INTERVAL = 4000;
const CAPTIONS = ["[UJI] Pilot drone dasar", "[UJI] Pemetaan udara", "[UJI] Kelas editing"];
const WORDS = ["terbang", "berkarya", "berbisnis"];

type Section = { id: string; type: string; content: Record<string, unknown> | null };

let heroId = "";
let original: Record<string, unknown> | null = null;
// Kontak marketing uji supaya floating contact dirender (dihapus di akhir).
let marketingId = "";

async function sections(request: APIRequestContext): Promise<Section[]> {
  const response = await request.get("/api/admin/home-sections");
  return ((await response.json()) as { data: Section[] }).data;
}

async function patchHero(request: APIRequestContext, content: Record<string, unknown>) {
  const response = await request.patch(`/api/admin/home-sections/${heroId}`, { headers: HEADERS, data: { content, visible: true } });
  expect(response.status(), await response.text()).toBe(200);
}

async function uploadPhoto(request: APIRequestContext, name: string, alt: string, file: { buffer: Buffer; mimeType: string }) {
  const response = await request.post("/api/admin/media", {
    headers: HEADERS,
    multipart: { files: { name, mimeType: file.mimeType, buffer: file.buffer }, folder: "uji" },
  });
  const id = ((await response.json()) as { data: { created: { id: string }[] } }).data.created[0].id;
  const altResponse = await request.patch(`/api/admin/media/${id}`, { headers: HEADERS, data: { alt } });
  expect(altResponse.status()).toBe(200);
  return id;
}

const hero = (page: Page) => page.locator("section[data-header-over]");
const segment = (page: Page, index: number) => page.getByRole("group", { name: "Pilih slide" }).getByRole("button").nth(index);

// Kata yang sedang tampil di slot RotatingWord (transform 0 / none).
async function visibleWord(page: Page): Promise<string> {
  return page.locator("[data-rotating-word] > span").evaluateAll((spans) => {
    const shown = spans.find((span) => {
      const transform = getComputedStyle(span).transform;
      return transform === "none" || transform === "matrix(1, 0, 0, 1, 0, 0)";
    });
    return shown?.textContent ?? "";
  });
}

// Pindahkan kursor & fokus keluar dari hero (di bawahnya), supaya jeda karena hover/fokus tidak ikut.
async function leaveHero(page: Page) {
  const box = await hero(page).boundingBox();
  await page.mouse.move(10, (box?.y ?? 0) + (box?.height ?? 0) + 40);
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
}

test.describe.configure({ mode: "serial" });

test.describe("hero slideshow", () => {
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ baseURL: ORIGIN });
    const request = context.request;
    await loginViaApi(request);
    const id = runId();
    let heroSection = (await sections(request)).find((section) => section.type === "HERO");
    if (!heroSection) {
      const created = await request.post("/api/admin/home-sections", {
        headers: HEADERS,
        data: { type: "HERO", content: { headline: "[UJI] Belajar dari praktisinya" } },
      });
      heroSection = ((await created.json()) as { data: Section }).data;
    }
    heroId = heroSection.id;
    original = heroSection.content;
    const marketing = await request.post("/api/admin/marketing", {
      headers: HEADERS,
      data: { name: `[UJI] Marketing hero ${id}`, phone: "6281200000911" },
    });
    expect(marketing.status(), await marketing.text()).toBe(201);
    marketingId = ((await marketing.json()) as { data: { id: string } }).data.id;

    const colors = [
      { from: "#3d5a40", to: "#c7b98a", seed: 11 },
      { from: "#2f4b66", to: "#d9d2c3", seed: 23 },
      { from: "#4a3b33", to: "#b8a07a", seed: 37 },
    ];
    const slides = [];
    for (const [index, color] of colors.entries()) {
      const mediaId = await uploadPhoto(request, `[UJI]-hero-${index + 1}-${id}.jpg`, `[UJI] Foto hero ${index + 1}`, await photoLikeJpeg(browser, color));
      slides.push({ mediaId, alt: "", caption: CAPTIONS[index], href: "", hudLabel: `LOKASI / UJI ${index + 1}`, focalX: 50, focalY: 50 });
    }
    await patchHero(request, {
      ...(original ?? {}),
      headline: (original?.headline as string | undefined) ?? "[UJI] Belajar dari praktisinya",
      rotatingWords: WORDS,
      layout: "fullbleed",
      intervalMs: INTERVAL,
      photoStyle: "color",
      showViewfinder: true,
      showBadge: true,
      badgeText: "Konsultasi gratis • Hubungi kami",
      badgeHref: "/kontak",
      slides,
      decor: true,
    });
    await expect.poll(async () => (await request.get("/")).text(), { timeout: 10_000 }).toContain("data-header-over");
    await context.close();
  });

  test.afterAll(async ({ browser }) => {
    const context = await browser.newContext({ baseURL: ORIGIN });
    await loginViaApi(context.request);
    if (heroId && original) await patchHero(context.request, original);
    if (marketingId) await context.request.delete(`/api/admin/marketing/${marketingId}`, { headers: HEADERS });
    await context.close();
  });

  test("berganti otomatis; header transparan; floating contact muncul setelah hero lewat", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 1400 });
    await page.goto("/");
    await expect(hero(page)).toBeVisible();
    await expect(page.locator("header.site-header")).toHaveCSS("position", "absolute");
    await expect(page.locator(".floating-contact")).toBeHidden();
    // Slide pertama = LCP: dimuat lebih dulu dengan prioritas tinggi.
    await expect(hero(page).getByRole("img", { name: "[UJI] Foto hero 1" })).toHaveAttribute("fetchpriority", "high");
    await leaveHero(page);
    await expect(segment(page, 0)).toHaveAttribute("aria-current", "true");
    await expect(segment(page, 1)).toHaveAttribute("aria-current", "true", { timeout: INTERVAL + 4000 });
    await expect(hero(page).getByText(CAPTIONS[1])).toBeVisible();

    // Beranda e2e bisa pendek (sedikit section): beri ruang gulir di akhir body supaya hero benar-benar
    // lewat ke atas layar.
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.evaluate(() => {
      const spacer = document.createElement("div");
      spacer.style.height = "2000px";
      document.body.append(spacer);
      window.scrollTo(0, document.documentElement.scrollHeight);
    });
    await expect(page.locator(".floating-contact")).toBeVisible();
    // Kembali ke atas: tersembunyi lagi.
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(page.locator(".floating-contact")).toBeHidden();
  });

  // cacheComponents menyimpan beranda di <Activity mode="hidden"> setelah pindah halaman: penanda hero
  // masih di DOM, tapi header & floating contact di halaman tujuan harus kembali normal.
  test("pindah menu lewat navigasi klien: header putih sticky di halaman lain, transparan lagi saat kembali", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    const header = page.locator("header.site-header");
    await expect(header).toHaveCSS("position", "absolute");
    await page.getByRole("navigation", { name: "Menu utama", exact: true }).locator('a[href^="/"]:not([href="/"])').first().click();
    await expect(page).not.toHaveURL(/\/$/);
    await expect(hero(page)).toBeHidden();
    await expect(header).toHaveCSS("position", "sticky");
    await expect(page.locator(".floating-contact")).toBeVisible();
    await page.goBack();
    await expect(hero(page)).toBeVisible();
    await expect(header).toHaveCSS("position", "absolute");
  });

  test("pause menghentikan slide dan kata berganti; play melanjutkan", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 1400 });
    await page.goto("/");
    await page.getByRole("button", { name: "Jeda slideshow" }).click();
    await expect(page.getByRole("button", { name: "Putar slideshow" })).toBeVisible();
    await leaveHero(page);
    const word = await visibleWord(page);
    await page.waitForTimeout(INTERVAL + 1500);
    await expect(segment(page, 0)).toHaveAttribute("aria-current", "true");
    expect(await visibleWord(page)).toBe(word);
    await expect(hero(page).getByText("JEDA", { exact: true })).toBeAttached();

    await page.getByRole("button", { name: "Putar slideshow" }).click();
    await leaveHero(page);
    await expect(segment(page, 1)).toHaveAttribute("aria-current", "true", { timeout: INTERVAL + 4000 });
    await expect.poll(() => visibleWord(page), { timeout: 5000 }).not.toBe(word);
  });

  test("klik segmen dan panah kiri/kanan memindah slide", async ({ page }) => {
    await page.goto("/");
    await segment(page, 2).click();
    await expect(segment(page, 2)).toHaveAttribute("aria-current", "true");
    await expect(hero(page).getByText(CAPTIONS[2])).toBeVisible();
    await expect(hero(page).getByText("03 / 03")).toBeVisible();
    await page.keyboard.press("ArrowLeft");
    await expect(segment(page, 1)).toHaveAttribute("aria-current", "true");
    await expect(segment(page, 1)).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await expect(segment(page, 0)).toHaveAttribute("aria-current", "true");
  });

  test("reduced motion: tanpa autoplay, kata pertama, tanpa tombol pause; segmen tetap bisa diklik", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1280, height: 1400 });
    await page.goto("/");
    await leaveHero(page);
    await page.waitForTimeout(INTERVAL + 1500);
    await expect(segment(page, 0)).toHaveAttribute("aria-current", "true");
    expect(await visibleWord(page)).toBe(WORDS[0]);
    await expect(hero(page).getByText("STATIS", { exact: true })).toBeAttached();
    await expect(page.getByRole("button", { name: "Jeda slideshow" })).toBeHidden();
    await segment(page, 1).click();
    await expect(segment(page, 1)).toHaveAttribute("aria-current", "true");
  });

  test("editor slide admin: urutan, titik fokus, pengaturan tampilan @screens", async ({ page }) => {
    await loginViaApi(page.request);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`/admin/home/${heroId}`);
    await expect(page.getByRole("button", { name: "Tambah slide" })).toBeVisible();
    await expect(page.getByText("3/6 slide.")).toBeVisible();
    await expect(page.getByRole("switch", { name: "Elemen dekoratif" })).toBeChecked();
    await page.getByRole("button", { name: "Atur slide 01" }).click();
    await expect(page.getByRole("spinbutton", { name: "Horizontal (%)" })).toHaveValue("50");
    const out = process.env.SCREENS_OUT;
    if (out) {
      mkdirSync(out, { recursive: true });
      await page.getByRole("heading", { name: "Slide", exact: true }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(out, "admin-editor-slide-1440.png"), fullPage: true });
    }
  });

  test("screenshot 360/768/1280 (hero & setelah scroll) @screens", async ({ page }) => {
    const out = process.env.SCREENS_OUT;
    test.skip(!out, "Butuh SCREENS_OUT.");
    mkdirSync(out ?? "", { recursive: true });
    for (const width of [360, 768, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/");
      await page.waitForTimeout(1200);
      await page.screenshot({ path: path.join(out ?? "", `hero-slides-${width}-layar1.png`) });
      await page.evaluate(() => window.scrollTo(0, window.innerHeight * 1.2));
      await page.waitForTimeout(800);
      await page.screenshot({ path: path.join(out ?? "", `hero-slides-${width}-scroll.png`) });
    }
  });
});
