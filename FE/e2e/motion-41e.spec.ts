import { devices, expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { createTraining, deleteTraining, firstCategory, loginViaApi, ORIGIN, runId, type CreatedTraining } from "./helpers";

// Fase 4.1e: kata hero berganti, marquee logo klien mengikuti scroll, progres
// baca, dan scroll-spy daftar isi. Konten uji dibuat lewat API di database e2e, berawalan [UJI].

const HEADERS = { Origin: ORIGIN };
const WORDS = ["sekarang", "lebih cepat", "bersama"];

async function post(request: APIRequestContext, url: string, data: unknown): Promise<{ id: string }> {
  const response = await request.post(`/api${url}`, { headers: HEADERS, data });
  expect(response.status(), `${url}: ${await response.text()}`).toBe(201);
  return ((await response.json()) as { data: { id: string } }).data;
}

// Indeks kata yang sedang terlihat di slot (transform none / translateY(0)).
const visibleWord = (page: Page) =>
  page.locator("[data-rotating-word] > span").evaluateAll((spans) =>
    spans.findIndex((span) => {
      const { transform } = getComputedStyle(span);
      return transform === "none" || transform === "matrix(1, 0, 0, 1, 0, 0)";
    }),
  );

async function wheel(page: Page, deltaY: number, steps = 6) {
  await page.mouse.move(640, 400);
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, deltaY / steps);
    await page.waitForTimeout(40);
  }
}

// Track marquee logo klien (marquee pertama yang berisi link).
const logoMarquee = (page: Page) => page.locator("[data-marquee]", { has: page.locator("a") }).first();
const trackTransform = (page: Page) => logoMarquee(page).locator("> div").evaluate((element) => (element as HTMLElement).style.transform);

// Total layout shift tanpa input (CLS kasar per sesi halaman).
function watchCls(page: Page) {
  return page.addInitScript(() => {
    (window as unknown as { __cls: number }).__cls = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) {
        if (!entry.hadRecentInput) (window as unknown as { __cls: number }).__cls += entry.value;
      }
    }).observe({ type: "layout-shift", buffered: true });
  });
}
const cls = (page: Page) => page.evaluate(() => (window as unknown as { __cls: number }).__cls);

test.describe.configure({ mode: "serial" });
test.describe("animasi 4.1e", () => {
  const id = runId();
  const sectionIds: string[] = [];
  const clientIds: string[] = [];
  let training: CreatedTraining;

  test.beforeAll(async ({ request }) => {
    await loginViaApi(request);
    // Beranda bersih supaya urutan section uji pasti (HERO hanya satu).
    const existing = await request.get("/api/admin/home-sections");
    for (const section of ((await existing.json()) as { data: { id: string }[] }).data) {
      await request.delete(`/api/admin/home-sections/${section.id}`, { headers: HEADERS });
    }
    for (const name of ["Satu", "Dua", "Tiga", "Empat", "Lima", "Enam", "Tujuh", "Delapan"]) {
      clientIds.push((await post(request, "/admin/clients", { name: `[UJI] Klien ${name} ${id}`, url: `https://klien-${name.toLowerCase()}.example` })).id);
    }
    const section = async (type: string, content: Record<string, unknown>) =>
      sectionIds.push((await post(request, "/admin/home-sections", { type, content })).id);
    await section("HERO", {
      eyebrow: "Uji",
      headline: `[UJI] Tim belajar ${id}`,
      rotatingWords: WORDS,
      subheadline: "Subjudul uji.",
      showSearch: true,
      searchPlaceholder: "",
      primaryCta: null,
      secondaryCta: null,
      image: null,
    });
    await section("LATEST_TRAININGS", { eyebrow: "Terbaru", heading: `[UJI] Terbaru ${id}`, mode: "auto", limit: 6 });
    await section("CLIENTS", { eyebrow: "Klien", heading: `[UJI] Klien ${id}`, mode: "auto", limit: 12 });
    await section("UPCOMING_SCHEDULES", { eyebrow: "Jadwal", heading: `[UJI] Jadwal ${id}`, limit: 5 });

    const category = await firstCategory(request);
    training = await createTraining(request, {
      title: `[UJI] Progres baca ${id}`,
      summary: "Pelatihan uji progres baca dan daftar isi.",
      categoryIds: [category.id],
      status: "PUBLISHED",
      modules: Array.from({ length: 6 }, (_, index) => ({ title: `Modul ${index + 1}`, points: ["Poin A", "Poin B", "Poin C"], durationMinutes: 60 })),
      audience: [{ role: "Supervisor", note: "yang memimpin tim" }],
      faq: [{ q: "Pertanyaan uji?", a: "Jawaban uji." }],
    });
    await expect.poll(async () => (await (await request.get("/")).text()).includes(id)).toBe(true);
  });

  test.afterAll(async ({ request }) => {
    await loginViaApi(request);
    for (const sectionId of sectionIds) await request.delete(`/api/admin/home-sections/${sectionId}`, { headers: HEADERS });
    for (const clientId of clientIds) await request.delete(`/api/admin/clients/${clientId}`, { headers: HEADERS });
    if (training) await deleteTraining(request, training.id);
  });

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  // Keputusan pemilik 15 Okt 2026 (DESIGN.md 9.2): kata tetap berganti tiap 2 s, tapi ada tombol
  // pause/play (WCAG 2.2.2). Kursor di judul tidak menahan pergantian.
  test("kata hero berganti terus tiap 2 s (juga saat kursor di judul); tombol jeda menghentikan; nama h1 utuh", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/");
    const h1 = page.getByRole("heading", { level: 1 });
    await expect(h1).toHaveAccessibleName(`[UJI] Tim belajar ${id} ${WORDS[0]}`);
    expect(await visibleWord(page)).toBe(0);
    await h1.hover();
    // Urutan kata yang tampil selama ~9 s: 0 -> 1 -> 2 -> 0 -> 1 (tidak berhenti setelah satu putaran).
    const sequence: number[] = [];
    const start = Date.now();
    while (Date.now() - start < 9_000) {
      const word = await visibleWord(page);
      if (word >= 0 && sequence.at(-1) !== word) sequence.push(word);
      await page.waitForTimeout(150);
    }
    expect(sequence.slice(0, 5)).toEqual([0, 1, 2, 0, 1]);

    // Jeda: kata berhenti; putar: lanjut lagi.
    await page.getByRole("button", { name: "Jeda kata berganti" }).click();
    const paused = await visibleWord(page);
    await page.waitForTimeout(3_000);
    expect(await visibleWord(page)).toBe(paused);
    await page.getByRole("button", { name: "Putar kata berganti" }).click();
    await expect.poll(() => visibleWord(page), { timeout: 5_000 }).not.toBe(paused);
  });

  test("marquee logo: berjalan sendiri tanpa scroll, berhenti saat kursor di atasnya; fokus logo menghentikan dan menampilkannya", async ({ page }) => {
    await page.goto("/");
    const marquee = logoMarquee(page);
    // Salinan kedua: aria-hidden + inert, dirender server (tanpa perubahan layout setelah load).
    await expect(marquee.locator("[data-marquee-copy][aria-hidden][inert]")).toHaveCount(1);
    await marquee.scrollIntoViewIfNeeded();
    // Kursor jauh dari marquee; tanpa scroll tetap bergerak.
    await page.mouse.move(5, 5);
    await page.waitForTimeout(1_500);
    const first = await trackTransform(page);
    await expect.poll(() => trackTransform(page), { timeout: 3_000 }).not.toBe(first);

    // Kursor di atas marquee: berhenti; kursor keluar: jalan lagi.
    await marquee.hover();
    await page.waitForTimeout(300);
    const held = await trackTransform(page);
    await page.waitForTimeout(800);
    expect(await trackTransform(page)).toBe(held);
    await page.mouse.move(5, 5);
    await expect.poll(() => trackTransform(page), { timeout: 3_000 }).not.toBe(held);

    // Fokus logo terakhir (biasanya di luar layar): terlihat utuh di dalam marquee.
    const last = page.getByRole("link", { name: new RegExp(`Klien Delapan ${id}`) });
    await last.focus();
    await expect(last).toBeFocused();
    const [box, root] = await Promise.all([last.boundingBox(), marquee.boundingBox()]);
    expect(box && root && box.x >= root.x - 1 && box.x + box.width <= root.x + root.width + 1).toBe(true);
    await wheel(page, 300);
    await page.waitForTimeout(300);
    const [boxAfter] = await Promise.all([last.boundingBox()]);
    expect(Math.abs((boxAfter?.x ?? 0) - (box?.x ?? 0))).toBeLessThan(1);
  });

  test("reduced motion: kata hero dan marquee diam", async ({ browser }) => {
    const context = await browser.newContext({ ...devices["Desktop Chrome"], baseURL: ORIGIN, locale: "id-ID", reducedMotion: "reduce", viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    await page.goto("/");
    await page.waitForTimeout(2_600);
    expect(await visibleWord(page)).toBe(0);
    // Marquee: dibungkus ke beberapa baris lewat CSS, salinan kedua tersembunyi, tanpa gerak.
    for (const marquee of await page.locator("[data-marquee]").all()) {
      await expect(marquee.locator("[data-marquee-copy]")).toBeHidden();
      await marquee.scrollIntoViewIfNeeded();
      const box = await marquee.boundingBox();
      const track = await marquee.locator("> div").boundingBox();
      expect((track?.width ?? 0) - (box?.width ?? 0)).toBeLessThanOrEqual(1);
    }
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(300);
    expect(await logoMarquee(page).locator("> div").evaluate((element) => (element as HTMLElement).style.transform)).toBe("");
    await context.close();
  });

  test("marquee di layar pertama tetap bergerak ikut scroll dan CLS tetap 0", async ({ page }) => {
    // Dibuka lewat anchor judul section klien: marquee sudah terlihat saat dimuat (muat penuh).
    await page.goto("/");
    const titleId = await page.getByRole("heading", { level: 2, name: `[UJI] Klien ${id}` }).getAttribute("id");
    await watchCls(page);
    await page.goto(`/#${titleId}`);
    await page.reload();
    await expect(logoMarquee(page)).toBeInViewport();
    await page.waitForTimeout(1_200);
    const resting = await trackTransform(page);
    await wheel(page, 300);
    await expect.poll(() => trackTransform(page)).not.toBe(resting);
    await page.waitForTimeout(800);
    expect(await cls(page)).toBe(0);
  });

  test("progres baca 0 -> 1 dan daftar isi menandai bagian yang dibaca", async ({ page }) => {
    await page.goto(`/pelatihan/${training.slug}`);
    const bar = page.locator("[data-reading-progress]");
    await expect.poll(() => bar.evaluate((element) => (element as HTMLElement).style.transform)).toBe("scaleX(0)");
    const toc = page.getByRole("navigation", { name: "Isi pelatihan", exact: true });
    await expect(toc.locator("a[aria-current=location]")).toHaveCount(1);

    await page.locator("#materi").scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, document.getElementById("materi")!.getBoundingClientRect().top - 100));
    await expect(toc.locator("a[aria-current=location]")).toHaveAttribute("href", "#materi");

    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect.poll(() => bar.evaluate((element) => (element as HTMLElement).style.transform)).toBe("scaleX(1)");
    const links = toc.locator("a");
    await expect(links.last()).toHaveAttribute("aria-current", "location");
  });
});
