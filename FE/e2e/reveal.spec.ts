import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { createTraining, deleteTraining, firstCategory, loginViaApi, ORIGIN, runId, type CreatedTraining } from "./helpers";

// Reveal saat scroll (useReveal, Fase 4.1b): elemen yang sudah terlihat tidak boleh disembunyikan
// atau berkedip saat halaman dibuka lewat anchor (#id) atau Back dengan scroll restoration.
// Pemantau per frame (addInitScript) mencatat setiap elemen grup reveal di dalam viewport yang
// sedang dalam keadaan awal (opacity 0 / transform / clip-path inline) atau sedang dianimasikan.
// Konten uji dibuat lewat API di database e2e, berawalan [UJI], dan dihapus di afterAll.

const HEADERS = { Origin: ORIGIN };
// Reveal terpanjang: stagger maksimum + durasi lambat (lihat tokens.ts), dibulatkan ke atas.
const SETTLE_MS = 1_800;

type Violation = { text: string; reason: string; scrollY: number };

declare global {
  interface Window {
    __reveal: { violations: Violation[]; anywhere: boolean };
    next: { router: { push: (href: string) => void } };
  }
}

function installRevealWatcher(page: Page) {
  return page.addInitScript(() => {
    window.__reveal = { violations: [], anywhere: false };
    const inView = (element: Element) => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight;
    };
    const hiddenReason = (element: HTMLElement) => {
      const { opacity, transform, clipPath } = element.style;
      if (opacity !== "" && opacity !== "1") return `opacity ${opacity}`;
      if (transform !== "" && transform !== "none") return `transform ${transform}`;
      if (clipPath !== "" && !/^inset\(0(%|px)?( 0(%|px)?)*\)$/.test(clipPath)) return `clip-path ${clipPath}`;
      return null;
    };
    const record = (element: Element, reason: string) => {
      const text = (element.textContent ?? element.getAttribute("alt") ?? element.tagName).trim().slice(0, 50);
      const { violations } = window.__reveal;
      if (!violations.some((violation) => violation.text === text && violation.reason === reason)) {
        violations.push({ text, reason, scrollY: Math.round(window.scrollY) });
      }
    };
    const tick = () => {
      const { anywhere } = window.__reveal;
      document.querySelectorAll<HTMLElement>("[data-reveal-root], [data-reveal-root] [style]").forEach((element) => {
        const reason = hiddenReason(element);
        if (reason && (anywhere || inView(element))) record(element, reason);
      });
      for (const animation of document.getAnimations()) {
        // Animasi CSS (headline hero, transisi hover) bukan bagian reveal saat scroll.
        if (animation instanceof CSSAnimation || animation instanceof CSSTransition) continue;
        const target = animation.effect instanceof KeyframeEffect ? animation.effect.target : null;
        if (target?.closest("[data-reveal-root]") && (anywhere || inView(target))) record(target, "animasi berjalan");
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

const resetViolations = (page: Page) => page.evaluate(() => (window.__reveal.violations = []));
const violations = (page: Page) => page.evaluate(() => window.__reveal.violations);

// Jumlah grup reveal yang (sebagian) terlihat: memastikan uji tidak lolos karena viewport kosong.
const revealRootsInView = (page: Page) =>
  page.evaluate(
    () =>
      [...document.querySelectorAll("[data-reveal-root]")].filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.bottom > 0 && rect.top < window.innerHeight;
      }).length,
  );

async function post(request: APIRequestContext, url: string, data: unknown): Promise<{ id: string }> {
  const response = await request.post(`/api${url}`, { headers: HEADERS, data });
  expect(response.status(), `${url}: ${await response.text()}`).toBe(201);
  return ((await response.json()) as { data: { id: string } }).data;
}

// Gulir seperti pengguna (roda mouse), lalu tunggu semua reveal yang terpicu selesai.
async function wheelTo(page: Page, targetY: number) {
  await page.mouse.move(640, 400);
  while ((await page.evaluate(() => window.scrollY)) < targetY - 10) {
    const before = await page.evaluate(() => window.scrollY);
    await page.mouse.wheel(0, Math.min(400, targetY - before));
    await page.waitForTimeout(80);
    if ((await page.evaluate(() => window.scrollY)) === before) break;
  }
  await page.waitForTimeout(SETTLE_MS);
}

test.describe.configure({ mode: "serial" });
test.describe("reveal saat scroll: anchor & Back", () => {
  const id = runId();
  const sectionIds: string[] = [];
  let training: CreatedTraining;

  test.beforeAll(async ({ request }) => {
    await loginViaApi(request);
    const category = await firstCategory(request);
    // Kategori pertama dari seed punya pelatihan lain, jadi grid "Pelatihan terkait" (target anchor #terkait-title) tampil.
    training = await createTraining(request, {
      title: `[UJI] Reveal anchor ${id}`,
      summary: "Pelatihan uji untuk anchor dan scroll restoration.",
      categoryIds: [category.id],
      status: "PUBLISHED",
      modules: [
        { title: "Modul pertama", points: ["Poin A1", "Poin A2"], durationMinutes: 90 },
        { title: "Modul kedua", points: ["Poin B1"], durationMinutes: 60 },
      ],
      audience: [{ role: "Supervisor", note: "yang memimpin tim kecil" }],
      faq: [{ q: "Pertanyaan uji reveal?", a: "Jawaban uji reveal." }],
    });
    const section = async (type: string, content: Record<string, unknown>) =>
      sectionIds.push((await post(request, "/admin/home-sections", { type, content })).id);
    await section("STATS", {
      eyebrow: "Angka",
      heading: `[UJI] Reveal angka ${id}`,
      items: [
        { value: 120, prefix: "", suffix: "+", label: "Trainer" },
        { value: 48, prefix: "", suffix: "", label: "Kota" },
      ],
    });
    await section("CATEGORIES", { eyebrow: "Kategori", heading: `[UJI] Reveal kategori ${id}`, mode: "auto", limit: 12 });
    await section("LATEST_TRAININGS", { eyebrow: "Terbaru", heading: `[UJI] Reveal terbaru ${id}`, mode: "auto", limit: 6 });
    await section("VISION_MISSION", {
      eyebrow: "Visi & misi",
      vision: "Menjadi mitra belajar uji yang dipercaya.",
      mission: ["Program relevan.", "Trainer praktisi.", "Materi terukur."],
    });
    await section("UPCOMING_SCHEDULES", { eyebrow: "Jadwal", heading: `[UJI] Reveal jadwal ${id}`, limit: 5 });
  });

  test.afterAll(async ({ request }) => {
    for (const sectionId of sectionIds) await request.delete(`/api/admin/home-sections/${sectionId}`, { headers: HEADERS });
    if (training) await deleteTraining(request, training.id);
  });

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await installRevealWatcher(page);
  });

  test("dibuka lewat anchor (#terkait-title, muat penuh): bagian terlihat tidak disembunyikan", async ({ page }) => {
    await expect.poll(async () => (await page.request.get(`/pelatihan/${training.slug}`)).status()).toBe(200);
    await page.goto(`/pelatihan/${training.slug}#terkait-title`);
    await expect(page.getByRole("heading", { level: 1, name: training.title })).toBeAttached();
    await page.waitForTimeout(SETTLE_MS);
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(200);
    expect(await revealRootsInView(page)).toBeGreaterThan(0);
    expect(await violations(page)).toEqual([]);
  });

  test("navigasi klien ke /pelatihan/<slug>#terkait-title: bagian terlihat tidak disembunyikan", async ({ page }) => {
    await page.goto("/pelatihan");
    await expect(page.getByRole("heading", { level: 1, name: "Pelatihan" })).toBeVisible();
    await resetViolations(page);
    await page.evaluate((href) => window.next.router.push(href), `/pelatihan/${training.slug}#terkait-title`);
    await expect(page.getByRole("heading", { level: 1, name: training.title })).toBeAttached();
    await page.waitForTimeout(SETTLE_MS);
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(200);
    expect(await revealRootsInView(page)).toBeGreaterThan(0);
    expect(await violations(page)).toEqual([]);
  });

  test("Back (navigasi klien) dengan scroll restoration: tidak ada yang disembunyikan atau berkedip", async ({ page }) => {
    await expect
      // Judul section dipecah per kata (RevealText), jadi cek id run saja di HTML mentah.
      .poll(async () => (await (await page.request.get("/")).text()).includes(id))
      .toBe(true);
    await page.goto("/");
    const grid = page.getByRole("heading", { level: 2, name: `[UJI] Reveal terbaru ${id}` });
    const gridTop = await grid.evaluate((element) => element.getBoundingClientRect().top + window.scrollY);
    await wheelTo(page, gridTop - 100);
    const scrolledY = await page.evaluate(() => window.scrollY);
    expect(scrolledY).toBeGreaterThan(400);

    // Ke detail pelatihan lewat kartu di section uji ini (sudah terlihat, jadi klik tidak menggulir), lalu Back.
    await page.locator("section", { has: grid }).locator("article a").first().click();
    await expect(page).toHaveURL(/\/pelatihan\/[^/]+$/);
    await resetViolations(page);
    await page.goBack();
    await expect(grid).toBeAttached();
    await page.waitForTimeout(SETTLE_MS);
    expect(Math.abs((await page.evaluate(() => window.scrollY)) - scrolledY)).toBeLessThan(80);
    expect(await revealRootsInView(page)).toBeGreaterThan(0);
    expect(await violations(page)).toEqual([]);
  });

  test("Back (muat ulang dokumen) dengan scroll restoration: tidak ada yang disembunyikan atau berkedip", async ({ page }) => {
    await page.goto("/");
    const schedules = page.getByRole("heading", { level: 2, name: `[UJI] Reveal jadwal ${id}` });
    const targetY = await schedules.evaluate((element) => element.getBoundingClientRect().top + window.scrollY - 100);
    await wheelTo(page, targetY);
    const scrolledY = await page.evaluate(() => window.scrollY);
    expect(scrolledY).toBeGreaterThan(400);

    // Dokumen baru (bukan navigasi klien), lalu Back: dari bfcache atau dimuat ulang + restoration.
    await page.goto("/layanan");
    await page.goBack();
    await expect(schedules).toBeAttached();
    await page.waitForTimeout(SETTLE_MS);
    expect(Math.abs((await page.evaluate(() => window.scrollY)) - scrolledY)).toBeLessThan(80);
    expect(await revealRootsInView(page)).toBeGreaterThan(0);
    expect(await violations(page)).toEqual([]);
  });

  test("reduced motion: tidak ada elemen yang disembunyikan atau dianimasikan di mana pun", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await page.evaluate(() => (window.__reveal.anywhere = true));
    await wheelTo(page, await page.evaluate(() => document.documentElement.scrollHeight));
    expect(await violations(page)).toEqual([]);
  });
});
