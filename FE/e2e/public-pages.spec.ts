import { mkdirSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { loginViaApi, ORIGIN, photoLikeJpeg, runId } from "./helpers";

// Halaman publik Fase 3.5: beranda dari CMS, profil, portofolio, layanan, halaman statis, footer.
// Jalankan dengan build produksi untuk verifikasi cache sungguhan: `npm run test:e2e:prod`.
// Konten uji dibuat lewat API di database e2e, berawalan [UJI].

const HEADERS = { Origin: ORIGIN };
const SCREEN_DIR = path.join(__dirname, "..", "test-results", "screens");

type Created = { id: string; slug?: string };

async function post<T = Created>(request: APIRequestContext, url: string, data: unknown): Promise<T> {
  const response = await request.post(`/api${url}`, { headers: HEADERS, data });
  expect(response.status(), `${url}: ${await response.text()}`).toBe(201);
  return ((await response.json()) as { data: T }).data;
}

async function patch(request: APIRequestContext, url: string, data: unknown) {
  const response = await request.patch(`/api${url}`, { headers: HEADERS, data });
  expect(response.status(), `${url}: ${await response.text()}`).toBe(200);
}

async function uploadImage(
  request: APIRequestContext,
  name: string,
  alt: string,
  file?: { buffer: Buffer; mimeType: string },
): Promise<string> {
  const buffer = file?.buffer ?? (await readFile(path.join(__dirname, "fixtures", "sample.png")));
  const response = await request.post("/api/admin/media", {
    headers: HEADERS,
    multipart: { files: { name, mimeType: file?.mimeType ?? "image/png", buffer }, folder: "uji" },
  });
  const id = ((await response.json()) as { data: { created: { id: string }[] } }).data.created[0].id;
  await patch(request, `/admin/media/${id}`, { alt });
  return id;
}

async function clearHome(request: APIRequestContext) {
  const response = await request.get("/api/admin/home-sections");
  for (const section of ((await response.json()) as { data: { id: string }[] }).data) {
    await request.delete(`/api/admin/home-sections/${section.id}`, { headers: HEADERS });
  }
}

// Heading berurutan tanpa lompat level (h1 -> h2 -> h3), tepat satu h1.
async function headingIssues(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const visible = (element: Element) => {
      const style = getComputedStyle(element);
      return style.display !== "none" && style.visibility !== "hidden";
    };
    const levels = [...document.querySelectorAll("main h1, main h2, main h3, main h4")]
      .filter(visible)
      .map((element) => Number(element.tagName[1]));
    const issues: string[] = [];
    if (levels.filter((level) => level === 1).length !== 1) issues.push(`jumlah h1 = ${levels.filter((l) => l === 1).length}`);
    levels.forEach((level, index) => {
      if (index > 0 && level > levels[index - 1] + 1) issues.push(`h${levels[index - 1]} -> h${level}`);
    });
    return issues;
  });
}

async function screenshots(page: Page, name: string, url: string) {
  mkdirSync(SCREEN_DIR, { recursive: true });
  for (const width of [360, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(url);
    await page.screenshot({ path: path.join(SCREEN_DIR, `${name}-${width}.png`), fullPage: true });
  }
  await page.setViewportSize({ width: 1280, height: 900 });
}

test.describe.configure({ mode: "serial" });

test.describe("beranda kosong", () => {
  // Dijalankan sebelum konten uji dibuat: beranda tanpa section sama sekali.
  test("beranda tanpa section: tetap rapi (header, footer, pesan netral)", async ({ page }) => {
    await loginViaApi(page.request);
    await clearHome(page.request);
    await expect
      .poll(async () => (await (await page.request.get("/")).text()).includes("Halaman beranda sedang disiapkan."), { timeout: 5_000 })
      .toBe(true);
    await page.goto("/");
    await expect(page.getByRole("banner")).toBeVisible();
    await expect(page.getByRole("contentinfo")).toBeVisible();
    expect(await headingIssues(page)).toEqual([]);
  });
});

test.describe("halaman publik", () => {
  const id = runId();
  let serviceSlug = "";
  let serviceId = "";
  let pageSlug = "";

  test.beforeAll(async ({ request, browser }) => {
    await loginViaApi(request);
    await clearHome(request);
    const heroImage = await uploadImage(
      request,
      `[UJI]-hero-${id}.jpg`,
      "[UJI] Peserta pelatihan berdiskusi",
      await photoLikeJpeg(browser),
    );
    const serviceImage = await uploadImage(request, `[UJI]-layanan-${id}.png`, "[UJI] Sesi in-house");
    const galleryA = await uploadImage(request, `[UJI]-galeri-a-${id}.png`, "[UJI] Dokumentasi kegiatan A");
    const galleryB = await uploadImage(request, `[UJI]-galeri-b-${id}.png`, "[UJI] Dokumentasi kegiatan B");

    const service = await post(request, "/admin/services", {
      title: `[UJI] In-house training ${id}`,
      summary: "Pelatihan di lokasi klien, materi disesuaikan kebutuhan tim.",
      body: {
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: "Detail layanan uji untuk verifikasi halaman publik." }] }],
      },
      imageId: serviceImage,
      status: "PUBLISHED",
    });
    serviceId = service.id;
    serviceSlug = service.slug ?? "";
    await post(request, "/admin/services", { title: `[UJI] Public training ${id}`, summary: "Kelas terbuka terjadwal.", status: "PUBLISHED" });
    for (const name of ["PT Uji Satu", "PT Uji Dua", "CV Uji Tiga"]) await post(request, "/admin/clients", { name: `[UJI] ${name}` });
    for (const [index, name] of ["Rina", "Bayu", "Sari"].entries()) {
      await post(request, "/admin/testimonials", {
        name: `[UJI] ${name}`,
        role: "Manajer HR",
        company: "PT Uji",
        quote: `Materi pelatihan uji ke-${index + 1} mudah diterapkan di pekerjaan sehari-hari.`,
      });
    }
    await post(request, "/admin/portfolio", {
      title: `[UJI] Workshop kepemimpinan ${id}`,
      date: "2026-09-15",
      client: "PT Uji",
      description: "Dokumentasi workshop dua hari.",
      imageIds: [galleryA, galleryB],
    });
    const staticPage = await post(request, "/admin/pages", {
      title: `[UJI] Syarat & ketentuan ${id}`,
      status: "PUBLISHED",
      blocks: [
        {
          id: crypto.randomUUID(),
          type: "RICH_TEXT",
          eyebrow: "",
          heading: "Ketentuan umum",
          body: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Isi ketentuan uji." }] }] },
        },
      ],
    });
    pageSlug = staticPage.slug ?? "";

    const section = (type: string, content: Record<string, unknown>) => post(request, "/admin/home-sections", { type, content });
    await section("HERO", {
      eyebrow: "Training provider",
      headline: "[UJI] Tim belajar lebih terarah",
      rotatingWords: ["sekarang"],
      subheadline: "Pelatihan public dan in-house dengan trainer praktisi.",
      showSearch: true,
      searchPlaceholder: "Cari pelatihan, mis. KPI",
      primaryCta: { label: "Lihat pelatihan", href: "/pelatihan" },
      secondaryCta: { label: "Lihat jadwal", href: "/jadwal" },
      slides: [{ mediaId: heroImage }],
    });
    await section("LATEST_TRAININGS", { eyebrow: "01 / Terbaru", heading: "Pelatihan terbaru", mode: "auto", limit: 3 });
    await section("UPCOMING_SCHEDULES", { eyebrow: "02 / Jadwal", heading: "Jadwal terdekat", limit: 5 });
    await section("CLIENTS", { eyebrow: "03 / Klien", heading: "Klien kami", mode: "auto", limit: 24 });
    await section("VISION_MISSION", { eyebrow: "04 / Visi & misi", vision: "Menjadi mitra belajar yang dipercaya.", mission: ["Program relevan.", "Trainer praktisi."] });
    await section("CTA", {
      eyebrow: "Konsultasi",
      heading: "Butuh pelatihan khusus untuk tim Anda?",
      body: "Ceritakan kebutuhan tim, kami bantu susun programnya.",
      primaryCta: { label: "Hubungi kami", href: "/kontak" },
    });
  });

  test("beranda: semua section dari CMS, satu h1, heading rapi, maks 2 section hitam, gambar hero prioritas", async ({ page }) => {
    await expect.poll(async () => (await page.request.get("/")).status()).toBe(200);
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: /\[UJI\] Tim belajar lebih terarah/ })).toBeVisible();
    for (const heading of ["Pelatihan terbaru", "Jadwal terdekat", "Klien kami"]) {
      await expect(page.getByRole("heading", { level: 2, name: heading })).toBeVisible();
    }
    expect(await headingIssues(page)).toEqual([]);
    // Section terbalik: CTA penutup + footer saja.
    expect(await page.locator(".bg-inverse-bg").count()).toBe(2);
    // Gambar hero dimuat lebih dulu; gambar lain lazy.
    const hero = page.getByRole("img", { name: "[UJI] Peserta pelatihan berdiskusi" });
    await expect(hero).toHaveAttribute("fetchpriority", "high");
    const lazy = await page.locator("main img:not([fetchpriority=high])").evaluateAll((images) =>
      images.every((image) => image.getAttribute("loading") === "lazy"),
    );
    expect(lazy).toBe(true);
    // Footer tanpa media partner.
    await expect(page.getByRole("contentinfo")).not.toContainText(/media partner/i);
  });

  test("hero di viewport 360: srcset memilih varian 768, bukan 1600", async ({ browser }) => {
    // Ukuran file yang dimuat dicatat ke test-results/hero-360.json untuk laporan.
    const loaded: { deviceScaleFactor: number; file: string; bytes: number }[] = [];
    for (const deviceScaleFactor of [1, 2, 3]) {
      const context = await browser.newContext({ viewport: { width: 360, height: 800 }, deviceScaleFactor });
      const page = await context.newPage();
      await page.goto(`${ORIGIN}/`);
      const hero = page.getByRole("img", { name: "[UJI] Peserta pelatihan berdiskusi" });
      await expect.poll(() => hero.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
      const { src, bytes } = await hero.evaluate((image: HTMLImageElement) => {
        const entry = performance.getEntriesByName(image.currentSrc)[0] as PerformanceResourceTiming | undefined;
        return { src: image.currentSrc, bytes: entry?.encodedBodySize ?? 0 };
      });
      loaded.push({ deviceScaleFactor, file: src.split("/").pop() ?? src, bytes });
      await context.close();
    }
    mkdirSync(path.dirname(SCREEN_DIR), { recursive: true });
    writeFileSync(path.join(path.dirname(SCREEN_DIR), "hero-360.json"), JSON.stringify(loaded, null, 2));
    // Lebar tampil 328 px: DPR 1-2 butuh <= 768 px, jadi varian 768 (bukan 1600).
    for (const entry of loaded.filter((item) => item.deviceScaleFactor <= 2)) expect(entry.file).toMatch(/-768\.webp$/);
  });

  test("layanan: daftar, detail, perubahan admin tampil < 5 detik, slug lama redirect", async ({ page }) => {
    await loginViaApi(page.request);
    await page.goto("/layanan");
    await expect(page.getByRole("heading", { level: 1, name: "Layanan" })).toBeVisible();
    expect(await headingIssues(page)).toEqual([]);
    await page.goto(`/layanan/${serviceSlug}`);
    await expect(page.getByRole("heading", { level: 1, name: new RegExp(`In-house training ${id}`) })).toBeVisible();
    expect(await headingIssues(page)).toEqual([]);

    // Tab yang masih membuka halaman layanan ditutup sebelum mutasi: di `next dev`, setiap revalidate
    // memicu refresh RSC otomatis di tab itu. Render yang masih berjalan saat slug diganti bisa
    // tersimpan sebagai cache segar slug lama (200, bukan 308). Pemeriksaan berikutnya lewat
    // page.request. BE juga mengirim revalidate susulan untuk ganti slug (revalidate-map.ts).
    await page.goto("about:blank");

    // Ubah judul di admin: halaman publik ikut berubah < 5 detik.
    await patch(page.request, `/admin/services/${serviceId}`, { title: `[UJI] In-house training ${id} edisi baru` });
    await expect
      .poll(async () => (await (await page.request.get(`/layanan/${serviceSlug}`)).text()).includes("edisi baru"), { timeout: 5_000 })
      .toBe(true);

    // Ganti slug: URL lama redirect permanen ke slug baru.
    const newSlug = `${serviceSlug}-baru`;
    await patch(page.request, `/admin/services/${serviceId}`, { slug: newSlug });
    await expect
      .poll(async () => (await page.request.get(`/layanan/${serviceSlug}`, { maxRedirects: 0 })).status(), { timeout: 5_000 })
      .toBe(308);
    const redirected = await page.request.get(`/layanan/${serviceSlug}`, { maxRedirects: 0 });
    expect(redirected.headers().location).toContain(`/layanan/${newSlug}`);
    serviceSlug = newSlug;
  });

  test("slug yang tidak ada: HTTP 404; halaman baru setelah build bisa diakses", async ({ page }) => {
    await loginViaApi(page.request);
    expect((await page.request.get("/layanan/tidak-ada-layanan-ini")).status()).toBe(404);
    expect((await page.request.get("/halaman-yang-tidak-ada")).status()).toBe(404);

    const fresh = await post(page.request, "/admin/pages", {
      title: `[UJI] Halaman baru ${id}`,
      status: "PUBLISHED",
      blocks: [{ id: crypto.randomUUID(), type: "LIST", eyebrow: "", heading: "Poin", style: "bullet", items: ["Satu"] }],
    });
    await expect.poll(async () => (await page.request.get(`/${fresh.slug}`)).status(), { timeout: 5_000 }).toBe(200);
    await page.goto(`/${pageSlug}`);
    await expect(page.getByRole("heading", { level: 1, name: new RegExp(`Syarat & ketentuan ${id}`) })).toBeVisible();
    expect(await headingIssues(page)).toEqual([]);
  });

  test("profil & portofolio", async ({ page }) => {
    await page.goto("/profil");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(await headingIssues(page)).toEqual([]);
    await page.goto("/profil/portofolio");
    await expect(page.getByRole("heading", { level: 2, name: new RegExp(`Workshop kepemimpinan ${id}`) })).toBeVisible();
    expect(await headingIssues(page)).toEqual([]);
  });

  test("pratinjau: layanan draf, halaman draf, beranda dengan section tersembunyi", async ({ page }) => {
    await loginViaApi(page.request);
    const draft = await post(page.request, "/admin/services", { title: `[UJI] Layanan draf ${id}`, status: "DRAFT" });
    expect((await page.request.get(`/layanan/${draft.slug}`)).status()).toBe(404);
    await page.goto(`/admin/preview?type=service&id=${draft.id}`);
    await expect(page).toHaveURL(new RegExp(`/layanan/${draft.slug}$`));
    await expect(page.getByText(/Mode pratinjau/)).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);

    const draftPage = await post(page.request, "/admin/pages", { title: `[UJI] Halaman draf ${id}`, status: "DRAFT" });
    await page.goto(`/admin/preview?type=page&id=${draftPage.id}`);
    await expect(page.getByRole("heading", { level: 1, name: new RegExp(`Halaman draf ${id}`) })).toBeVisible();

    const sections = ((await (await page.request.get("/api/admin/home-sections")).json()) as { data: { id: string; type: string }[] }).data;
    const clients = sections.find((section) => section.type === "CLIENTS");
    await patch(page.request, `/admin/home-sections/${clients?.id}`, { visible: false });
    await page.goto("/admin/preview?type=home");
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText("Tersembunyi · tidak tampil di publik")).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Klien kami" })).toBeVisible();

    // Keluar dari pratinjau: section tersembunyi tidak tampil.
    await page.getByRole("button", { name: "Keluar dari pratinjau" }).click();
    await expect(page.getByText(/Mode pratinjau/)).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 2, name: "Klien kami" })).toHaveCount(0);
    await patch(page.request, `/admin/home-sections/${clients?.id}`, { visible: true });
  });

  test("screenshot 360/768/1280 px @screens", async ({ page }) => {
    await screenshots(page, "beranda", "/");
    await screenshots(page, "profil", "/profil");
    await screenshots(page, "layanan", "/layanan");
    await screenshots(page, "layanan-detail", `/layanan/${serviceSlug}`);
    await screenshots(page, "portofolio", "/profil/portofolio");
  });
});
