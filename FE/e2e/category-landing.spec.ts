import { mkdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { expect, test, type APIRequestContext, type Browser, type Page } from "@playwright/test";
import { createTraining, deleteTraining, loginViaApi, ORIGIN, photoLikeJpeg, runId, type CreatedTraining } from "./helpers";

// Halaman kategori v2 (permintaan atasan 4 Nov 2026): cover (Category.imageId, juga fallback sampul
// pelatihan), Tentang, daftar judul + cari judul, target peserta + badge "Dirangkum dari", galeri
// 4 foto + lightbox keyboard, section kosong disembunyikan beserta tab-nya, command palette ke
// landing, tautan "Lihat galeri kategori" dari detail pelatihan, proteksi media galeri kategori.
// Data uji hanya di training_e2e: kategori dibuat per run lalu dihapus di akhir.
// Screenshot (opsional): SCREENS_OUT=<folder> npx playwright test e2e/category-landing.spec.ts

const HEADERS = { Origin: ORIGIN };

test.describe.configure({ mode: "serial" });

type CardJson = { slug: string; coverSource: "training" | "category" | null; cover: { alt: string | null } | null };
type Ref = { id: string; slug: string; name: string };

const id = runId();
// Token unik di nama kategori (bukan di judul pelatihan) supaya mudah dicari di command palette.
const token = `zk${id}`;
const CATEGORY_NAME = `[UJI] Landing ${token}`;
const COVER_ALT = "[UJI] Foto cover kategori";
const DESCRIPTION = "Paragraf pertama tentang kategori uji.\n\nParagraf kedua tentang kategori uji.";

let category: Ref;
let withCover: CreatedTraining;
let withoutCover: CreatedTraining;
let coverImage = "";
const galleryImages: string[] = [];
const mediaIds: string[] = [];

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

async function uploadJpeg(request: APIRequestContext, browser: Browser, name: string, alt: string | null, seed: number) {
  const file = await photoLikeJpeg(browser, { seed });
  return upload(request, name, file.buffer, file.mimeType, alt);
}

async function uploadPng(request: APIRequestContext, name: string, alt: string | null) {
  const buffer = await readFile(path.join(__dirname, "fixtures", "sample.png"));
  return upload(request, name, buffer, "image/png", alt);
}

async function upload(request: APIRequestContext, name: string, buffer: Buffer, mimeType: string, alt: string | null) {
  const response = await request.post("/api/admin/media", {
    headers: HEADERS,
    multipart: { files: { name, mimeType, buffer }, folder: "uji" },
  });
  expect(response.status(), await response.text()).toBe(201);
  const mediaId = ((await response.json()) as { data: { created: { id: string }[] } }).data.created[0].id;
  if (alt) {
    const altResponse = await request.patch(`/api/admin/media/${mediaId}`, { headers: HEADERS, data: { alt } });
    expect(altResponse.status()).toBe(200);
  }
  mediaIds.push(mediaId);
  return mediaId;
}

async function patchCategory(request: APIRequestContext, data: Record<string, unknown>) {
  const response = await request.patch(`/api/admin/categories/${category.id}`, { headers: HEADERS, data });
  expect(response.status(), await response.text()).toBe(200);
  return ((await response.json()) as { data: Record<string, unknown> }).data;
}

const landing = () => `/pelatihan/kategori/${category.slug}`;
const tabs = (page: Page) => page.getByRole("navigation", { name: "Isi kategori" });
const card = (page: Page, title: string) => page.locator("article[data-cursor-label]", { hasText: title });

// Cache halaman publik di-revalidate BE setelah mutasi; ulangi goto sampai perubahan terlihat.
async function gotoUntil(page: Page, url: string, ready: () => Promise<boolean>) {
  await expect
    .poll(async () => {
      await page.goto(url);
      return ready();
    })
    .toBe(true);
}

test.describe("halaman kategori v2", () => {
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ baseURL: ORIGIN });
    const request = context.request;
    await loginViaApi(request);
    const created = await request.post("/api/admin/categories", { headers: HEADERS, data: { name: CATEGORY_NAME } });
    expect(created.status(), await created.text()).toBe(201);
    category = ((await created.json()) as { data: Ref }).data;
    const ownCover = await uploadJpeg(request, browser, `[UJI]-sampul-${id}.jpg`, "[UJI] Foto sampul sendiri", 5);
    withCover = await createTraining(request, {
      title: `[UJI] Alpha bersampul ${id}`,
      categoryIds: [category.id],
      status: "PUBLISHED",
      coverId: ownCover,
      types: ["PUBLIC", "IN_HOUSE"],
      audience: [{ role: "Staf uji", note: null }, { role: "Supervisor uji", note: null }],
    });
    withoutCover = await createTraining(request, {
      title: `[UJI] Beta tanpa sampul ${id}`,
      categoryIds: [category.id],
      status: "PUBLISHED",
      audience: [{ role: "Staf uji.", note: null }],
    });
    await context.close();
  });

  test.afterAll(async ({ browser }) => {
    const context = await browser.newContext({ baseURL: ORIGIN });
    const request = context.request;
    await loginViaApi(request);
    if (withCover) await deleteTraining(request, withCover.id);
    if (withoutCover) await deleteTraining(request, withoutCover.id);
    if (category) await request.delete(`/api/admin/categories/${category.id}`, { headers: HEADERS });
    // Media yang masih dirujuk item di Sampah boleh gagal dihapus; database e2e di-reset tiap run.
    for (const mediaId of mediaIds) await request.delete(`/api/admin/media/${mediaId}`, { headers: HEADERS });
    await context.close();
  });

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
  });

  test("kategori belum diisi: hanya daftar pelatihan; section & tab kosong disembunyikan, hero tanpa cover", async ({ page }) => {
    await page.goto(landing());
    await expect(page.getByRole("heading", { level: 1, name: CATEGORY_NAME })).toBeVisible();
    await expect(tabs(page).getByRole("link")).toHaveCount(1);
    await expect(tabs(page).getByRole("link", { name: "Daftar pelatihan (2)" })).toBeVisible();
    for (const section of ["#tentang", "#peserta", "#galeri"]) await expect(page.locator(section)).toHaveCount(0);
    await expect(page.locator("[data-category-cover]")).toHaveCount(0);
    await expect(page.getByText("Dirangkum dari")).toHaveCount(0);
  });

  test("admin: cover & galeri wajib punya alt; galeri maks 4", async ({ page, browser }) => {
    const request = page.request;
    await loginViaApi(request);
    const noAlt = await uploadPng(request, `[UJI]-tanpa-alt-${id}.png`, null);
    const coverRejected = await request.patch(`/api/admin/categories/${category.id}`, { headers: HEADERS, data: { imageId: noAlt } });
    expect(coverRejected.status()).toBe(422);
    expect(((await coverRejected.json()) as { error: { fields: Record<string, string[]> } }).error.fields.imageId).toBeTruthy();
    const galleryRejected = await request.patch(`/api/admin/categories/${category.id}`, { headers: HEADERS, data: { imageIds: [noAlt] } });
    expect(galleryRejected.status()).toBe(422);
    expect(((await galleryRejected.json()) as { error: { fields: Record<string, string[]> } }).error.fields["imageIds.0"]).toBeTruthy();

    coverImage = await uploadJpeg(request, browser, `[UJI]-cover-${id}.jpg`, COVER_ALT, 13);
    for (let n = 1; n <= 5; n += 1) galleryImages.push(await uploadPng(request, `[UJI]-galeri-${n}-${id}.png`, `[UJI] Dokumentasi ${n}`));
    const tooMany = await request.patch(`/api/admin/categories/${category.id}`, { headers: HEADERS, data: { imageIds: galleryImages } });
    expect(tooMany.status()).toBe(422);

    const saved = await patchCategory(request, {
      imageId: coverImage,
      imageIds: galleryImages.slice(0, 4),
      summary: "Ringkasan kategori uji untuk mesin pencari.",
      description: DESCRIPTION,
    });
    expect(saved).toMatchObject({ imageId: coverImage, imageIds: galleryImages.slice(0, 4) });
  });

  test("landing terisi: cover ber-Viewfinder, Tentang per paragraf, meta description dari ringkasan", async ({ page }) => {
    await gotoUntil(page, landing(), async () => (await page.locator("#galeri").count()) === 1);
    const cover = page.locator("[data-category-cover]");
    await expect(cover.getByRole("img", { name: COVER_ALT })).toBeVisible();
    await expect(cover).toContainText(new RegExp(`Kategori / ${escapeRegExp(CATEGORY_NAME)}`, "i"));
    const about = page.locator("#tentang [data-category-description] p");
    await expect(about).toHaveText(["Paragraf pertama tentang kategori uji.", "Paragraf kedua tentang kategori uji."]);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", "Ringkasan kategori uji untuk mesin pencari.");
    await expect(tabs(page).getByRole("link")).toHaveText(["Tentang", "Daftar pelatihan (2)", "Galeri"]);
  });

  test("daftar pelatihan: urut A-Z, tipe tampil, cari judul di klien, klik judul ke detail", async ({ page }) => {
    await page.goto(landing());
    const list = page.locator("#daftar ol");
    await expect(list.getByRole("link")).toHaveCount(2);
    await expect(list.getByRole("link").nth(0)).toContainText(withCover.title);
    await expect(list.getByRole("link").nth(0)).toContainText("Public / In-house");

    const search = page.getByLabel("Cari judul pelatihan");
    await search.fill("beta");
    await expect(list.getByRole("link")).toHaveCount(1);
    await expect(list.getByRole("link")).toContainText(withoutCover.title);
    await search.fill(`tidakada${id}`);
    await expect(page.getByText("Tidak ada judul yang cocok.")).toBeVisible();
    await search.fill("");
    await expect(page.locator("#daftar ol").getByRole("link")).toHaveCount(2);

    await page.locator("#daftar ol").getByRole("link", { name: new RegExp(escapeRegExp(withoutCover.title)) }).click();
    await expect(page).toHaveURL(new RegExp(`/pelatihan/${withoutCover.slug}$`));
    await expect(page.getByRole("heading", { level: 1, name: withoutCover.title })).toBeVisible();
  });

  test("API: saran target peserta dirangkum per pelatihan; badge 'Dirangkum dari' hanya kalau terisi & auto", async ({ page }) => {
    const request = page.request;
    await loginViaApi(request);
    const suggestions = await request.get(`/api/admin/categories/${category.id}/audience-suggestions`);
    expect(suggestions.status()).toBe(200);
    const body = (await suggestions.json()) as { data: { trainingsConsidered: number; suggestions: { label: string; trainingCount: number }[] } };
    expect(body.data.trainingsConsidered).toBe(2);
    // "Staf uji" dan "Staf uji." digabung (tanda baca ujung dibuang): disebut 2 pelatihan.
    expect(body.data.suggestions).toEqual([
      { label: "Staf uji", trainingCount: 2 },
      { label: "Supervisor uji", trainingCount: 1 },
    ]);

    await patchCategory(request, { audience: body.data.suggestions, audienceSource: "auto" });
    await gotoUntil(page, landing(), async () => (await page.locator("#peserta").count()) === 1);
    const audience = page.locator("#peserta");
    await expect(audience.getByRole("heading", { level: 2, name: "Siapa yang cocok ikut" })).toBeVisible();
    await expect(audience.getByRole("listitem")).toHaveCount(2);
    await expect(audience.getByRole("listitem").first()).toContainText("2 pelatihan");
    await expect(audience.getByText(/Dirangkum dari 2 pelatihan/)).toBeVisible();

    // Manual: badge hilang, daftar tetap.
    await patchCategory(request, { audienceSource: "manual" });
    await gotoUntil(page, landing(), async () => (await page.getByText(/Dirangkum dari/).count()) === 0);
    await expect(page.locator("#peserta").getByRole("listitem")).toHaveCount(2);

    // Audience dikosongkan walau dikirim "auto": BE menyimpan "manual", section & badge tidak tampil.
    const emptied = await patchCategory(request, { audience: [], audienceSource: "auto" });
    expect(emptied.audienceSource).toBe("manual");
    await gotoUntil(page, landing(), async () => (await page.locator("#peserta").count()) === 0);
    await expect(page.getByText(/Dirangkum dari/)).toHaveCount(0);
    await expect(tabs(page).getByRole("link", { name: "Target peserta" })).toHaveCount(0);

    await patchCategory(request, { audience: body.data.suggestions, audienceSource: "auto" });
  });

  test("galeri: mozaik 4 foto, lightbox keyboard (buka, panah, Esc, fokus kembali)", async ({ page }) => {
    await page.goto(landing());
    const gallery = page.locator("#galeri");
    await expect(gallery.getByRole("heading", { level: 2, name: "Dokumentasi kegiatan" })).toBeVisible();
    const openers = gallery.getByRole("button", { name: /^Buka foto \d+ dari 4$/ });
    await expect(openers).toHaveCount(4);

    const first = gallery.getByRole("button", { name: "Buka foto 1 dari 4" });
    await first.focus();
    await page.keyboard.press("Enter");
    const lightbox = page.getByRole("dialog", { name: `Galeri ${CATEGORY_NAME}` });
    await expect(lightbox).toBeVisible();
    await expect(lightbox).toContainText("Foto 1 / 4");
    await expect(lightbox.getByRole("img", { name: "[UJI] Dokumentasi 1" })).toBeVisible();
    await page.keyboard.press("ArrowRight");
    await expect(lightbox).toContainText("Foto 2 / 4");
    await expect(lightbox.getByRole("img", { name: "[UJI] Dokumentasi 2" })).toBeVisible();
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    // Berputar dari foto pertama ke foto terakhir.
    await expect(lightbox).toContainText("Foto 4 / 4");
    await page.keyboard.press("Escape");
    await expect(lightbox).toBeHidden();
    await expect(first).toBeFocused();

    // Tombol "Foto berikutnya" dan "Tutup" juga bisa dipakai.
    await gallery.getByRole("button", { name: "Buka foto 3 dari 4" }).click();
    await lightbox.getByRole("button", { name: "Foto berikutnya" }).click();
    await expect(lightbox).toContainText("Foto 4 / 4");
    await lightbox.getByRole("button", { name: "Tutup" }).click();
    await expect(lightbox).toBeHidden();
    await expect(gallery.getByRole("button", { name: "Buka foto 3 dari 4" })).toBeFocused();
  });

  test("command palette: hasil kategori membuka halaman landing", async ({ page }) => {
    await page.goto("/");
    const palette = page.getByRole("dialog", { name: "Cari pelatihan" });
    await expect(async () => {
      if (!(await palette.isVisible())) await page.keyboard.press("ControlOrMeta+K");
      await expect(palette).toBeVisible({ timeout: 1_000 });
    }).toPass({ timeout: 15_000 });
    await palette.getByRole("combobox", { name: "Kata kunci" }).fill(token);
    // Pelatihan di kategori ini ikut cocok lewat nama kategori; pilih opsi kategorinya (nama diawali nama kategori).
    const option = palette.getByRole("option", { name: new RegExp(`^${escapeRegExp(CATEGORY_NAME)}`) });
    await expect(option).toHaveAttribute("href", landing());
    await option.click();
    await expect(page).toHaveURL(new RegExp(`${escapeRegExp(landing())}$`));
    await expect(page.getByRole("heading", { level: 1, name: CATEGORY_NAME })).toBeVisible();
  });

  test("grid /pelatihan: cari kategori, cover dari Category.image lalu foto galeri, badge unggulan, klik ke landing", async ({ page }) => {
    const tile = page.locator(`[data-category-card="${category.slug}"]`);
    await gotoUntil(page, `/pelatihan?q=${token}`, async () => (await tile.count()) === 1);
    await expect(page.getByRole("status").filter({ hasText: /kategori cocok/i })).toHaveText(/^1 kategori cocok$/i);
    await expect(tile.getByRole("img")).toHaveAttribute("alt", COVER_ALT);
    await expect(tile).toContainText(/2 pelatihan/i);
    await expect(tile).not.toContainText("Unggulan");

    // Cover kosong -> foto pertama galeri; unggulan -> badge.
    await loginViaApi(page.request);
    await patchCategory(page.request, { imageId: null, featured: true });
    try {
      await gotoUntil(page, `/pelatihan?q=${token}`, async () => (await tile.getByText("Unggulan").count()) === 1);
      await expect(tile.getByRole("img")).toHaveCount(1);
      await expect(tile.getByRole("img")).toHaveAttribute("alt", /^\[UJI\] Dokumentasi \d$/);
    } finally {
      await patchCategory(page.request, { imageId: coverImage, featured: false });
    }

    await tile.click();
    await expect(page).toHaveURL(new RegExp(`${escapeRegExp(landing())}$`));
    await expect(page.getByRole("heading", { level: 1, name: CATEGORY_NAME })).toBeVisible();
  });

  test("detail pelatihan: tanpa galeri sendiri; tautan 'Lihat galeri kategori' ke #galeri", async ({ page }) => {
    await gotoUntil(page, `/pelatihan/${withoutCover.slug}`, async () =>
      (await page.getByRole("link", { name: new RegExp(`Lihat galeri kategori ${escapeRegExp(CATEGORY_NAME)}`) }).count()) === 1,
    );
    await expect(page.locator("#galeri")).toHaveCount(0);
    const link = page.getByRole("link", { name: new RegExp(`Lihat galeri kategori ${escapeRegExp(CATEGORY_NAME)}`) });
    await expect(link).toHaveAttribute("href", `${landing()}#galeri`);
    await link.click();
    await expect(page).toHaveURL(new RegExp(`${escapeRegExp(landing())}#galeri$`));
    await expect(page.locator("#galeri")).toBeVisible();

    // Galeri dikosongkan: tautan hilang dari detail.
    await loginViaApi(page.request);
    await patchCategory(page.request, { imageIds: [] });
    await gotoUntil(page, `/pelatihan/${withoutCover.slug}`, async () =>
      (await page.getByRole("link", { name: /Lihat galeri kategori/ }).count()) === 0,
    );
    await patchCategory(page.request, { imageIds: galleryImages.slice(0, 4) });
  });

  test("API publik & kartu katalog: sampul sendiri = training, sampul kosong = cover kategori", async ({ page, request }) => {
    const cards = async (q: string): Promise<CardJson[]> => {
      const response = await request.get(`/api/public/trainings?q=${encodeURIComponent(q)}&kategori=${category.slug}`);
      expect(response.status()).toBe(200);
      return ((await response.json()) as { data: CardJson[] }).data;
    };
    await expect.poll(async () => (await cards(`Beta tanpa sampul ${id}`))[0]?.coverSource).toBe("category");
    expect((await cards(`Beta tanpa sampul ${id}`))[0].cover?.alt).toBe(COVER_ALT);
    expect((await cards(`Alpha bersampul ${id}`))[0]).toMatchObject({ coverSource: "training", cover: { alt: "[UJI] Foto sampul sendiri" } });

    // Kartu pelatihan tidak lagi di /pelatihan: cek di "Pelatihan terkait" (kategori uji hanya berisi dua pelatihan ini).
    await gotoUntil(page, `/pelatihan/${withCover.slug}`, async () =>
      (await card(page, withoutCover.title).getAttribute("data-cover-source")) === "category",
    );
    await expect(card(page, withoutCover.title).getByRole("img", { name: COVER_ALT })).toHaveCount(1);
    await page.goto(`/pelatihan/${withoutCover.slug}`);
    await expect(card(page, withCover.title)).toHaveAttribute("data-cover-source", "training");

    await page.goto(`/pelatihan/${withoutCover.slug}`);
    const photo = page.locator("[data-training-cover]");
    await expect(photo).toHaveAttribute("data-cover-source", "category");
    await expect(photo.getByRole("img", { name: COVER_ALT })).toBeVisible();
  });

  test("media yang dipakai cover atau galeri kategori tidak bisa dihapus (MEDIA_IN_USE)", async ({ page }) => {
    const request = page.request;
    await loginViaApi(request);
    for (const [mediaId, field] of [
      [coverImage, "Gambar"],
      [galleryImages[0], "Galeri kategori"],
    ] as const) {
      const response = await request.delete(`/api/admin/media/${mediaId}`, { headers: HEADERS });
      expect(response.status()).toBe(409);
      const body = (await response.json()) as { error: { code: string; details: { usages: { entity: string; label: string; field: string }[] } } };
      expect(body.error.code).toBe("MEDIA_IN_USE");
      expect(body.error.details.usages).toContainEqual(expect.objectContaining({ entity: "Category", label: CATEGORY_NAME, field }));
    }
  });

  test("admin daftar kategori: kolom gambar, filter tanpa gambar, urut pelatihan aktif terbanyak", async ({ page }) => {
    const request = page.request;
    await loginViaApi(request);
    const withoutImage = (await (await request.get("/api/admin/categories?issue=no-image&pageSize=100")).json()) as { data: { id: string }[] };
    expect(withoutImage.data.map((row) => row.id)).not.toContain(category.id);
    const sorted = (await (await request.get("/api/admin/categories?sort=-trainingCount&pageSize=20")).json()) as {
      data: { trainingCount: number }[];
    };
    const counts = sorted.data.map((row) => row.trainingCount);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));

    await page.goto("/admin/categories");
    await expect(page.getByRole("columnheader", { name: "Gambar" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Pelatihan aktif" })).toBeVisible();
  });

  test("mobile 360: tanpa scroll horizontal, cover di bawah judul", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(landing());
    await expect(page.getByRole("heading", { level: 1, name: CATEGORY_NAME })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
    const title = await page.getByRole("heading", { level: 1 }).boundingBox();
    const cover = await page.locator("[data-category-cover]").boundingBox();
    if (!title || !cover) throw new Error("judul atau cover tidak terlihat");
    expect(cover.y).toBeGreaterThan(title.y);
  });

  test("screenshot landing kategori 360/768/1280", async ({ page }) => {
    const out = process.env.SCREENS_OUT;
    test.skip(!out, "Butuh SCREENS_OUT.");
    const dir = out ?? "";
    mkdirSync(dir, { recursive: true });
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const width of [360, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(landing());
      await page.locator("footer").first().waitFor();
      await page.waitForTimeout(700);
      await page.screenshot({ path: path.join(dir, `landing-kategori-${width}.png`), fullPage: true });
    }
  });
});
