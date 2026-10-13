import { devices, expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { createTraining, deleteTraining, firstCategory, loginViaApi, ORIGIN, runId, type CreatedTraining } from "./helpers";

// Fase 4.1e: kata hero berganti, counter statistik, marquee logo klien mengikuti scroll, progres
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

const trackTransform = (page: Page) => page.locator("[data-marquee] > div").first().evaluate((element) => (element as HTMLElement).style.transform);

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
    await section("STATS", {
      eyebrow: "Angka",
      heading: `[UJI] Angka ${id}`,
      items: [
        { value: 1200, prefix: "", suffix: "+", label: "Alumni" },
        { value: 48, prefix: "", suffix: "", label: "Kota" },
      ],
    });
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

  test("kata hero berganti satu putaran lalu berhenti di kata pertama <= 5 s; nama h1 utuh", async ({ page }) => {
    await page.goto("/");
    const h1 = page.getByRole("heading", { level: 1 });
    await expect(h1).toHaveAccessibleName(`[UJI] Tim belajar ${id} ${WORDS[0]}`);
    expect(await visibleWord(page)).toBe(0);
    // Kata lain sempat tampil (urutan 1, 2), lalu kembali ke kata pertama sebelum 5 s.
    const seen = new Set<number>();
    const start = Date.now();
    while (Date.now() - start < 4_600) {
      seen.add(await visibleWord(page));
      await page.waitForTimeout(100);
    }
    expect([...seen]).toEqual(expect.arrayContaining([0, 1, 2]));
    await page.waitForTimeout(800);
    expect(await visibleWord(page)).toBe(0);
    await page.waitForTimeout(2_500);
    expect(await visibleWord(page)).toBe(0);
  });

  test("counter berjalan di bawah layar awal, berakhir di angka final, tanpa layout shift", async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { __cls: number }).__cls = 0;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) {
          if (!entry.hadRecentInput) (window as unknown as { __cls: number }).__cls += entry.value;
        }
      }).observe({ type: "layout-shift", buffered: true });
    });
    await page.goto("/");
    const counter = page.locator("[data-reveal-count='1200']");
    // Di bawah layar awal: ditahan di 0 sebelum terlihat (item masih tersembunyi).
    expect(await counter.evaluate((element) => element.getBoundingClientRect().top)).toBeGreaterThan(800);
    const samples: string[] = [];
    await counter.scrollIntoViewIfNeeded();
    for (let i = 0; i < 12; i++) {
      samples.push((await counter.textContent()) ?? "");
      await page.waitForTimeout(60);
    }
    await expect(counter).toHaveText("1.200");
    expect(samples.some((text) => text !== "1.200")).toBe(true);
    // Pembaca layar: nilai final satu kali (angka berjalan aria-hidden).
    await expect(page.getByRole("definition").filter({ hasText: "1.200" }).first()).toBeAttached();
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => (window as unknown as { __cls: number }).__cls)).toBe(0);
  });

  test("marquee logo: diam tanpa scroll, bergerak ikut scroll, berhenti lagi; fokus logo menghentikan dan menampilkannya", async ({ page }) => {
    await page.goto("/");
    const marquee = page.locator("[data-marquee]").first();
    await expect(marquee).toHaveAttribute("data-marquee", "on");
    // Salinan kedua: aria-hidden + inert.
    await expect(marquee.locator("[aria-hidden][inert]")).toHaveCount(1);
    await marquee.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1_500);
    const resting = await trackTransform(page);
    await page.waitForTimeout(500);
    expect(await trackTransform(page)).toBe(resting);

    await wheel(page, 600);
    await expect.poll(() => trackTransform(page)).not.toBe(resting);
    await page.waitForTimeout(2_000);
    const stopped = await trackTransform(page);
    await page.waitForTimeout(500);
    expect(await trackTransform(page)).toBe(stopped);

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

  test("reduced motion: kata hero, counter, dan marquee diam", async ({ browser }) => {
    const context = await browser.newContext({ ...devices["Desktop Chrome"], baseURL: ORIGIN, locale: "id-ID", reducedMotion: "reduce", viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    await page.goto("/");
    await page.waitForTimeout(2_600);
    expect(await visibleWord(page)).toBe(0);
    await expect(page.locator("[data-marquee]").first()).toHaveAttribute("data-marquee", "static");
    const counter = page.locator("[data-reveal-count='1200']");
    await counter.scrollIntoViewIfNeeded();
    await expect(counter).toHaveText("1.200");
    expect(await page.locator("[data-marquee] > div").first().evaluate((element) => (element as HTMLElement).style.transform)).toBe("");
    await context.close();
  });

  test("progres baca 0 -> 1 dan daftar isi menandai bagian yang dibaca", async ({ page }) => {
    await page.goto(`/pelatihan/${training.slug}`);
    const bar = page.locator("[data-reading-progress]");
    await expect.poll(() => bar.evaluate((element) => (element as HTMLElement).style.transform)).toBe("scaleX(0)");
    const toc = page.getByRole("navigation", { name: "Daftar isi", exact: true });
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
