import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { createTraining, deleteTraining, firstCategory, loginViaApi, ORIGIN, photoLikeJpeg, runId, type CreatedTraining } from "./helpers";

// Halaman pelatihan: /pelatihan = grid kategori (keputusan atasan 5 Nov 2026; tanpa sidebar filter,
// urutan, atau kartu pelatihan; kartu ke halaman kategori; URL lama ?kategori= -> 308), kartu
// pelatihan tanpa sampul (blok UI 4:3, dicek di "Pelatihan terkait"), landing kategori v2 (daftar
// judul tanpa kartu; detail lengkap di category-landing.spec.ts), detail (satu navigasi isi, tingkat
// & sertifikat, silabus per hari, sesi di form inquiry).
// Data uji hanya di database training_e2e: foto JPEG buatan generator (bukan foto mockup).
// Screenshot 360/768/1280 (opsional): SCREENS_OUT=<folder> npx playwright test e2e/training-pages.spec.ts

const HEADERS = { Origin: ORIGIN };
const CITY = "Kota Uji";

test.describe.configure({ mode: "serial" });

let category: { id: string; slug: string; name: string };
let withCover: CreatedTraining;
let withoutCover: CreatedTraining;
let scheduleId = "";
const mediaIds: string[] = [];

async function uploadPhoto(request: APIRequestContext, name: string, alt: string, file: { buffer: Buffer; mimeType: string }) {
  const response = await request.post("/api/admin/media", {
    headers: HEADERS,
    multipart: { files: { name, mimeType: file.mimeType, buffer: file.buffer }, folder: "uji" },
  });
  expect(response.status(), await response.text()).toBe(201);
  const id = ((await response.json()) as { data: { created: { id: string }[] } }).data.created[0].id;
  const altResponse = await request.patch(`/api/admin/media/${id}`, { headers: HEADERS, data: { alt } });
  expect(altResponse.status()).toBe(200);
  mediaIds.push(id);
  return id;
}

// Tanggal YYYY-MM-DD n hari dari sekarang.
const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const card = (page: Page, title: string) => page.locator("article[data-cursor-label]", { hasText: title });

test.describe("halaman pelatihan v0.2", () => {
  const id = runId();

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ baseURL: ORIGIN });
    const request = context.request;
    await loginViaApi(request);
    category = await firstCategory(request);
    const cover = await uploadPhoto(request, `[UJI]-cover-${id}.jpg`, "[UJI] Foto sampul pelatihan", await photoLikeJpeg(browser));
    withCover = await createTraining(request, {
      title: `[UJI] Bersampul ${id}`,
      summary: "Ringkasan uji pelatihan bersampul.",
      categoryIds: [category.id],
      status: "PUBLISHED",
      coverId: cover,
      level: "BEGINNER",
      certificate: true,
      duration: "2 hari",
      method: "OFFLINE",
      types: ["PUBLIC"],
      modules: [
        { title: "Mengenal alat", points: ["Komponen"], day: 1 },
        { title: "Praktik lapangan", points: ["Misi singkat"], day: 2 },
      ],
    });
    withoutCover = await createTraining(request, {
      title: `[UJI] Tanpa sampul ${id}`,
      categoryIds: [category.id],
      status: "PUBLISHED",
      method: "ONLINE",
    });
    const schedule = await request.post("/api/admin/schedules", {
      headers: HEADERS,
      data: { trainingId: withCover.id, startDate: inDays(30), endDate: inDays(31), city: CITY, method: "OFFLINE", status: "OPEN" },
    });
    expect(schedule.status(), await schedule.text()).toBe(201);
    scheduleId = ((await schedule.json()) as { data: { id: string } }).data.id;
    await expect.poll(async () => (await request.get(`/pelatihan/${withCover.slug}`)).text()).toContain(CITY);
    await context.close();
  });

  test.afterAll(async ({ browser }) => {
    const context = await browser.newContext({ baseURL: ORIGIN });
    const request = context.request;
    await loginViaApi(request);
    if (scheduleId) await request.delete(`/api/admin/schedules/${scheduleId}`, { headers: HEADERS });
    if (withCover) await deleteTraining(request, withCover.id);
    if (withoutCover) await deleteTraining(request, withoutCover.id);
    // Media yang masih dirujuk pelatihan di Sampah boleh gagal dihapus; database e2e di-reset tiap run.
    for (const mediaId of mediaIds) await request.delete(`/api/admin/media/${mediaId}`, { headers: HEADERS });
    await context.close();
  });

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
  });

  test("/pelatihan: grid kategori (tanpa sidebar/urutan/kartu pelatihan), kartu ke halaman kategori, cari kosong", async ({ page }) => {
    await page.goto("/pelatihan");
    await expect(page.getByRole("heading", { level: 1, name: "Pilih kategori pelatihan" })).toBeVisible();
    await expect(page.getByRole("complementary", { name: "Filter" })).toHaveCount(0);
    await expect(page.getByRole("group", { name: "Metode" })).toHaveCount(0);
    await expect(page.getByRole("list", { name: "Filter aktif" })).toHaveCount(0);
    await expect(page.locator("article[data-cursor-label]")).toHaveCount(0);

    // Cari kategori uji lewat GET ?q=, lalu kartunya (satu tautan) membuka halaman kategori.
    await page.goto(`/pelatihan?q=${encodeURIComponent(category.name)}`);
    const tile = page.locator(`[data-category-card="${category.slug}"]`);
    await expect(tile).toHaveAttribute("href", `/pelatihan/kategori/${category.slug}`);
    await expect(tile.getByRole("heading", { level: 3 })).toHaveText(category.name);
    await expect(tile).toContainText(/\d+ pelatihan/i);
    await expect(tile.locator("a")).toHaveCount(0);
    await tile.click();
    await expect(page).toHaveURL(new RegExp(`/pelatihan/kategori/${category.slug}$`));
    await expect(page.getByRole("heading", { level: 1, name: category.name })).toBeVisible();

    await page.goto(`/pelatihan?q=tidakadasamasekali${id}`);
    await expect(page.getByText(`Kategori “tidakadasamasekali${id}” tidak ditemukan`)).toBeVisible();
    await expect(page.getByRole("link", { name: "Lihat semua kategori" })).toHaveAttribute("href", "/pelatihan");

    // CTA penutup ke kontak.
    await expect(page.getByRole("region", { name: "Tidak menemukan topik yang dicari?" }).getByRole("link", { name: /Request pelatihan in-house/ })).toHaveAttribute("href", "/kontak");
  });

  test("katalog: /pelatihan?kategori=<slug> dialihkan 308 ke halaman kategori v2", async ({ page }) => {
    // Status 308 + Location dari server (bukan alih di klien).
    const raw = await page.request.get(`/pelatihan?kategori=${category.slug}&metode=offline`, { maxRedirects: 0 });
    expect(raw.status()).toBe(308);
    expect(new URL(raw.headers()["location"] ?? "", ORIGIN).pathname).toBe(`/pelatihan/kategori/${category.slug}`);

    // Alih server-side: parameter lain dibuang, URL akhir adalah halaman kategori.
    await page.goto(`/pelatihan?kategori=${category.slug}&metode=offline&q=apa`);
    await expect(page).toHaveURL(new RegExp(`/pelatihan/kategori/${category.slug}$`));
    await expect(page.getByRole("heading", { level: 1, name: category.name })).toBeVisible();

    // Slug tak dikenal: kembali ke /pelatihan.
    await page.goto(`/pelatihan?kategori=tidak-ada-kategori-${id}`);
    await expect(page).toHaveURL(/\/pelatihan$/);
    await expect(page.getByRole("heading", { level: 1, name: "Pilih kategori pelatihan" })).toBeVisible();
  });

  test("tanpa scroll horizontal di 360 px (grid kategori, halaman kategori, detail)", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    for (const url of ["/pelatihan", `/pelatihan/kategori/${category.slug}`, `/pelatihan/${withCover.slug}`]) {
      await page.goto(url);
      await expect(page.locator("h1")).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth), url).toBeLessThanOrEqual(360);
    }
  });

  test("kartu tanpa sampul: blok 4:3 berisi label kategori; landing kategori: daftar judul tanpa kartu", async ({ page }) => {
    // Kartu pelatihan tidak lagi di /pelatihan; cek di "Pelatihan terkait" detail (kategori sama, terbaru dulu).
    await page.goto(`/pelatihan/${withCover.slug}`);
    const bare = card(page, withoutCover.title);
    await bare.scrollIntoViewIfNeeded();
    const block = bare.locator("[data-reveal=image]");
    await expect(block.locator("img")).toHaveCount(0);
    await expect(block).toContainText(category.name);
    const box = await block.boundingBox();
    if (!box) throw new Error("blok gambar tidak terlihat");
    expect(box.width / box.height).toBeCloseTo(4 / 3, 1);

    await page.goto(`/pelatihan/${withoutCover.slug}`);
    const covered = card(page, withCover.title);
    await covered.scrollIntoViewIfNeeded();
    await expect(covered.getByRole("img")).toHaveAttribute("alt", "[UJI] Foto sampul pelatihan");

    // Landing kategori v2: tanpa chip kategori lain, statistik, kartu, filter metode, maupun paginasi.
    await page.goto(`/pelatihan/kategori/${category.slug}`);
    await expect(page.getByRole("heading", { level: 1, name: category.name })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Kategori lain" })).toHaveCount(0);
    await expect(page.getByText("Judul / aktif")).toHaveCount(0);
    await expect(page.getByRole("group", { name: "Metode" })).toHaveCount(0);
    await expect(page.locator("article[data-cursor-label]")).toHaveCount(0);
    const list = page.locator("#daftar ol");
    await expect(list.getByRole("link", { name: new RegExp(escapeRegExp(withCover.title)) })).toHaveAttribute("href", `/pelatihan/${withCover.slug}`);
    await expect(list.getByRole("link", { name: new RegExp(escapeRegExp(withoutCover.title)) })).toBeVisible();
  });

  test("detail: satu navigasi isi, tingkat & sertifikat, silabus per hari, sesi di form inquiry, foto ber-HUD", async ({ page }) => {
    await page.goto(`/pelatihan/${withCover.slug}`);
    await expect(page.getByRole("navigation", { name: "Isi pelatihan", exact: true })).toHaveCount(1);
    await expect(page.getByRole("navigation", { name: /daftar isi/i })).toHaveCount(0);

    await expect(page.getByRole("list", { name: "Kategori dan tingkat" })).toContainText("Dasar");
    await expect(page.locator("dl[aria-label='Fakta pelatihan']")).toContainText("SertifikatYa");
    await expect(page.locator("#materi")).toContainText("Hari 01");
    await expect(page.locator("#materi")).toContainText("Hari 02");

    const cover = page.locator("[data-training-cover]");
    await expect(cover.getByRole("img", { name: "[UJI] Foto sampul pelatihan" })).toBeVisible();
    await expect(cover).toContainText(`Lokasi / ${CITY}`);

    const session = page.locator("#inquiry").getByLabel("Sesi (opsional)");
    await expect(session.locator("option")).toHaveCount(2);
    await expect(session.locator("option").nth(1)).toContainText(CITY);

    // Tanpa sampul: tanpa blok gambar.
    await page.goto(`/pelatihan/${withoutCover.slug}`);
    await expect(page.getByRole("heading", { level: 1, name: withoutCover.title })).toBeVisible();
    await expect(page.locator("[data-training-cover]")).toHaveCount(0);
    await expect(page.locator("dl[aria-label='Fakta pelatihan']")).not.toContainText("Sertifikat");
  });

  // Data lama hasil impor bisa berjudul kosong (validator admin menolaknya, jadi judul dikosongkan
  // langsung di training_e2e lewat script BE). Halaman tidak boleh crash atau punya heading kosong.
  test("judul kosong (data lama): kartu dan detail tetap tampil, tanpa heading kosong", async ({ page }) => {
    const request = page.request;
    await loginViaApi(request);
    const blank = await createTraining(request, { title: `[UJI] Akan dikosongkan ${id}`, categoryIds: [category.id], status: "PUBLISHED" });
    try {
      const result = spawnSync("npm", ["run", "db:e2e:blank-title", "--", blank.slug], {
        cwd: path.resolve(__dirname, "../../BE"),
        shell: true,
        encoding: "utf8",
      });
      expect(result.status, result.stderr || result.stdout).toBe(0);

      const response = await page.goto(`/pelatihan/${blank.slug}`);
      expect(response?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1, name: "Tanpa judul" })).toBeVisible();
      await expect(page.locator("h1, h2, h3").filter({ hasText: /^\s*$/ })).toHaveCount(0);

      await page.goto(`/pelatihan/kategori/${category.slug}`);
      const untitled = page.locator(`#daftar ol a[href="/pelatihan/${blank.slug}"]`);
      await expect(untitled).toContainText("Tanpa judul");
      await expect(page.locator("h1, h2, h3").filter({ hasText: /^\s*$/ })).toHaveCount(0);
    } finally {
      await deleteTraining(request, blank.id);
    }
  });

  // Screenshot kondisi e2e (dengan sampul): beberapa pelatihan seed di kategori ini diberi foto uji
  // sementara, lalu dikembalikan.
  test("screenshot katalog, kategori, detail di 360/768/1280", async ({ page, browser }) => {
    const out = process.env.SCREENS_OUT;
    test.skip(!out, "Butuh SCREENS_OUT.");
    test.setTimeout(240_000);
    const dir = out ?? "";
    mkdirSync(dir, { recursive: true });
    const request = page.request;
    await loginViaApi(request);
    // Halaman pertama katalog (urut terbaru) dan landing kategori diberi foto uji.
    const list = (await (await request.get(`/api/admin/trainings?status=PUBLISHED&pageSize=12&sort=-publishedAt`)).json()) as {
      data: { id: string; cover: { id: string } | null }[];
    };
    const colors = [
      { from: "#4a6a52", to: "#c8c39a", seed: 3 },
      { from: "#3c5a7a", to: "#d6c3a0", seed: 11 },
      { from: "#6b4f3a", to: "#9fb7c9", seed: 19 },
    ];
    const photos: string[] = [];
    for (const [index, color] of colors.entries()) {
      photos.push(await uploadPhoto(request, `[UJI]-katalog-${index}-${id}.jpg`, `[UJI] Foto katalog ${index + 1}`, await photoLikeJpeg(browser, color)));
    }
    const changed: { id: string; coverId: string | null }[] = [];
    try {
      const inCategory = (await (await request.get(`/api/admin/trainings?categoryId=${category.id}&pageSize=6&sort=-publishedAt`)).json()) as typeof list;
      const targets = [...list.data, ...inCategory.data].filter(
        (row, index, all) => row.id !== withoutCover.id && row.id !== withCover.id && all.findIndex((other) => other.id === row.id) === index,
      );
      // Sebagian tetap tanpa sampul supaya kedua bentuk kartu terlihat.
      for (const [index, item] of targets.filter((_, index) => index % 3 !== 2).entries()) {
        changed.push({ id: item.id, coverId: item.cover?.id ?? null });
        const response = await request.patch(`/api/admin/trainings/${item.id}`, { headers: HEADERS, data: { coverId: photos[index % photos.length] } });
        expect(response.status(), await response.text()).toBe(200);
      }
      const shots: [string, string, (p: Page) => Promise<void>][] = [
        ["katalog", "/pelatihan", async () => {}],
        ["katalog-hal-2", "/pelatihan?page=2", async () => {}],
        ["katalog-kosong", `/pelatihan?q=tidakadasamasekali${id}`, async () => {}],
        ["katalog-cari", `/pelatihan?q=${encodeURIComponent(category.name.split(" ")[0])}`, async () => {}],
        ["kategori", `/pelatihan/kategori/${category.slug}`, async () => {}],
        ["detail", `/pelatihan/${withCover.slug}`, async () => {}],
        ["detail-tanpa-sampul", `/pelatihan/${withoutCover.slug}`, async () => {}],
      ];
      for (const width of [360, 768, 1280]) {
        await page.setViewportSize({ width, height: 900 });
        for (const [name, url, prepare] of shots) {
          await page.goto(url);
          await prepare(page);
          // Reveal saat scroll: gulir sampai bawah supaya semua kartu tampil di screenshot penuh.
          await page.evaluate(async () => {
            for (let y = 0; y < document.body.scrollHeight; y += 400) {
              window.scrollTo(0, y);
              await new Promise((resolve) => setTimeout(resolve, 60));
            }
            window.scrollTo(0, 0);
          });
          await page.waitForTimeout(700);
          await page.screenshot({ path: path.join(dir, `${name}-${width}.png`), fullPage: true });
        }
      }
    } finally {
      for (const item of changed) {
        await request.patch(`/api/admin/trainings/${item.id}`, { headers: HEADERS, data: { coverId: item.coverId } });
      }
    }
  });
});
