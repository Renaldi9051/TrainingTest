import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { createTraining, deleteTraining, firstCategory, loginViaApi, ORIGIN, photoLikeJpeg, runId, type CreatedTraining } from "./helpers";

// Halaman pelatihan redesign v0.2 (fase 4): katalog dengan sidebar filter (kategori pilih banyak
// tanpa role checkbox, chip filter aktif, empty state, overlay indeks A-Z, panel terlipat di mobile),
// kartu tanpa sampul (blok UI 4:3), landing kategori (label tingkat, filter metode), detail (satu
// navigasi isi, tingkat & sertifikat, silabus per hari, sesi di form inquiry).
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

  test("katalog: kategori pilih banyak tanpa role checkbox, chip filter aktif bisa dilepas, empty state", async ({ page }) => {
    await page.goto(`/pelatihan?kategori=${category.slug}`);
    const filter = page.getByRole("complementary", { name: "Filter" });
    await expect(filter.getByRole("checkbox")).toHaveCount(0);
    const selected = page.getByRole("group", { name: "Kategori" }).locator('a[aria-current="true"]');
    await expect(selected).toHaveCount(1);
    // Teks tersembunyi "terpilih" untuk pembaca layar.
    await expect(selected).toHaveAccessibleName(new RegExp(`${escapeRegExp(category.name)}.*terpilih`));

    const remove = page.getByRole("list", { name: "Filter aktif" }).getByRole("link", { name: `Hapus filter ${category.name}` });
    await remove.click();
    await expect(page).toHaveURL(/\/pelatihan$/);
    await expect(page.getByRole("list", { name: "Filter aktif" })).toHaveCount(0);

    await page.goto(`/pelatihan?q=tidakadasamasekali${id}`);
    await expect(page.getByText("Pelatihan tidak ditemukan.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Reset filter" })).toHaveAttribute("href", "/pelatihan");
  });

  test("katalog: Indeks kategori A-Z membuka overlay, saringan ketik, pilihan menambah filter", async ({ page }) => {
    await page.goto("/pelatihan");
    await page.getByRole("button", { name: "Indeks kategori A-Z" }).click();
    const overlay = page.getByRole("dialog", { name: "Indeks kategori / A-Z" });
    await expect(overlay).toBeVisible();
    await overlay.getByLabel("Saring kategori").fill(category.name);
    await overlay.getByRole("link", { name: new RegExp(`^${escapeRegExp(category.name)}`) }).first().click();
    await expect(page).toHaveURL(new RegExp(`kategori=${category.slug}`));
    await expect(overlay).toBeHidden();
  });

  test("katalog mobile: panel filter terlipat, terbuka otomatis kalau ada filter", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto("/pelatihan");
    const metode = page.getByRole("group", { name: "Metode" });
    await expect(metode).toBeHidden();
    await page.locator("summary", { hasText: "Filter" }).click();
    await expect(metode).toBeVisible();

    await page.goto("/pelatihan?metode=online");
    await expect(page.getByRole("group", { name: "Metode" })).toBeVisible();

    // Tanpa scroll horizontal di 360 px (kotak cari, tab isi yang bisa digeser, chip kategori lain).
    await page.setViewportSize({ width: 360, height: 800 });
    for (const url of ["/pelatihan", `/pelatihan/kategori/${category.slug}`, `/pelatihan/${withCover.slug}`]) {
      await page.goto(url);
      await expect(page.locator("h1")).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth), url).toBeLessThanOrEqual(360);
    }
  });

  test("kartu tanpa sampul: blok 4:3 berisi label kategori; landing kategori memakai label tingkat", async ({ page }) => {
    await page.goto(`/pelatihan/kategori/${category.slug}`);
    await expect(page.getByRole("heading", { level: 1, name: category.name })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Kategori lain" })).toBeVisible();
    await expect(page.getByText("Judul / aktif")).toBeVisible();

    const bare = card(page, withoutCover.title);
    const block = bare.locator("[data-reveal=image]");
    await expect(block.locator("img")).toHaveCount(0);
    await expect(block).toContainText(category.name);
    const box = await block.boundingBox();
    if (!box) throw new Error("blok gambar tidak terlihat");
    expect(box.width / box.height).toBeCloseTo(4 / 3, 1);

    const covered = card(page, withCover.title);
    await expect(covered.getByRole("img")).toHaveAttribute("alt", "[UJI] Foto sampul pelatihan");
    // Label tingkat (bukan kategori) di landing kategori.
    await expect(covered.locator("p").first()).toHaveText("Dasar");

    // Filter metode di landing (query ?metode=).
    await page.getByRole("group", { name: "Metode" }).getByRole("link", { name: "Online" }).click();
    await expect(page).toHaveURL(/metode=online/);
    await expect(card(page, withoutCover.title)).toBeVisible();
    await expect(card(page, withCover.title)).toHaveCount(0);
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
      const untitled = page.locator(`article[data-cursor-label]:has(a[href="/pelatihan/${blank.slug}"])`);
      await expect(untitled.getByRole("link", { name: "Tanpa judul" })).toBeVisible();
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
        ["katalog-filter", `/pelatihan?kategori=${category.slug}&metode=offline`, async () => {}],
        ["katalog-kosong", `/pelatihan?q=tidakadasamasekali${id}`, async () => {}],
        ["katalog-az", "/pelatihan", async (p) => {
          await p.getByRole("button", { name: "Indeks kategori A-Z" }).click();
          await expect(p.getByRole("dialog", { name: "Indeks kategori / A-Z" })).toBeVisible();
          await p.waitForTimeout(400);
        }],
        ["kategori", `/pelatihan/kategori/${category.slug}`, async () => {}],
        ["detail", `/pelatihan/${withCover.slug}`, async () => {}],
        ["detail-tanpa-sampul", `/pelatihan/${withoutCover.slug}`, async () => {}],
      ];
      for (const width of [360, 768, 1280]) {
        await page.setViewportSize({ width, height: 900 });
        for (const [name, url, prepare] of shots) {
          await page.goto(url);
          // Mobile/tablet: tombol indeks ada di dalam panel filter yang terlipat.
          if (name === "katalog-az" && width < 1024) await page.locator("summary", { hasText: "Filter" }).click();
          await prepare(page);
          // Reveal saat scroll: gulir sampai bawah supaya semua kartu tampil di screenshot penuh.
          if (name !== "katalog-az") {
            await page.evaluate(async () => {
              for (let y = 0; y < document.body.scrollHeight; y += 400) {
                window.scrollTo(0, y);
                await new Promise((resolve) => setTimeout(resolve, 60));
              }
              window.scrollTo(0, 0);
            });
            await page.waitForTimeout(700);
          }
          await page.screenshot({ path: path.join(dir, `${name}-${width}.png`), fullPage: name !== "katalog-az" });
        }
      }
    } finally {
      for (const item of changed) {
        await request.patch(`/api/admin/trainings/${item.id}`, { headers: HEADERS, data: { coverId: item.coverId } });
      }
    }
  });
});
