import { mkdirSync } from "node:fs";
import path from "node:path";
import { expect, test, type APIRequestContext, type Browser, type Page } from "@playwright/test";
import { createTraining, deleteTraining, firstCategory, loginViaApi, ORIGIN, photoLikeJpeg, runId, type CreatedTraining } from "./helpers";

// Gambar kategori sebagai fallback sampul: pelatihan tanpa sampul memakai gambar kategori pertamanya
// (coverSource "category") di kartu katalog, landing kategori, dan detail; landing kategori
// menampilkan foto lebar ber-Viewfinder; media yang dipakai kategori tidak bisa dihapus.
// Data uji hanya di database training_e2e; gambar kategori dikembalikan kosong di akhir.
// Screenshot katalog & landing (opsional): SCREENS_OUT=<folder> npx playwright test e2e/category-image.spec.ts

const HEADERS = { Origin: ORIGIN };

test.describe.configure({ mode: "serial" });

type CardJson = { slug: string; coverSource: "training" | "category" | null; cover: { alt: string | null } | null };

let category: { id: string; slug: string; name: string };
let previousImageId: string | null = null;
let withCover: CreatedTraining;
let withoutCover: CreatedTraining;
const mediaIds: string[] = [];
const CATEGORY_ALT = "[UJI] Foto kategori";

async function uploadPhoto(request: APIRequestContext, browser: Browser, name: string, alt: string | null, seed: number) {
  const file = await photoLikeJpeg(browser, { seed });
  const response = await request.post("/api/admin/media", {
    headers: HEADERS,
    multipart: { files: { name, mimeType: file.mimeType, buffer: file.buffer }, folder: "uji" },
  });
  expect(response.status(), await response.text()).toBe(201);
  const id = ((await response.json()) as { data: { created: { id: string }[] } }).data.created[0].id;
  if (alt) {
    const altResponse = await request.patch(`/api/admin/media/${id}`, { headers: HEADERS, data: { alt } });
    expect(altResponse.status()).toBe(200);
  }
  mediaIds.push(id);
  return id;
}

const card = (page: Page, title: string) => page.locator("article[data-cursor-label]", { hasText: title });

async function publicCards(request: APIRequestContext, q: string): Promise<CardJson[]> {
  const response = await request.get(`/api/public/trainings?q=${encodeURIComponent(q)}&kategori=${category.slug}`);
  expect(response.status()).toBe(200);
  return ((await response.json()) as { data: CardJson[] }).data;
}

test.describe("gambar kategori", () => {
  const id = runId();
  let categoryImage = "";

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ baseURL: ORIGIN });
    const request = context.request;
    await loginViaApi(request);
    category = await firstCategory(request);
    const current = await request.get(`/api/admin/categories/${category.id}`);
    previousImageId = ((await current.json()) as { data: { imageId: string | null } }).data.imageId;
    const cover = await uploadPhoto(request, browser, `[UJI]-sampul-${id}.jpg`, "[UJI] Foto sampul sendiri", 5);
    withCover = await createTraining(request, {
      title: `[UJI] Gambar sendiri ${id}`,
      categoryIds: [category.id],
      status: "PUBLISHED",
      coverId: cover,
    });
    withoutCover = await createTraining(request, {
      title: `[UJI] Ikut kategori ${id}`,
      categoryIds: [category.id],
      status: "PUBLISHED",
    });
    await context.close();
  });

  test.afterAll(async ({ browser }) => {
    const context = await browser.newContext({ baseURL: ORIGIN });
    const request = context.request;
    await loginViaApi(request);
    if (category) {
      await request.patch(`/api/admin/categories/${category.id}`, { headers: HEADERS, data: { imageId: previousImageId } });
    }
    if (withCover) await deleteTraining(request, withCover.id);
    if (withoutCover) await deleteTraining(request, withoutCover.id);
    // Media yang masih dirujuk pelatihan di Sampah boleh gagal dihapus; database e2e di-reset tiap run.
    for (const mediaId of mediaIds) await request.delete(`/api/admin/media/${mediaId}`, { headers: HEADERS });
    await context.close();
  });

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
  });

  test("admin: gambar kategori wajib punya alt; tersimpan dengan alt", async ({ page, browser }) => {
    const request = page.request;
    await loginViaApi(request);
    const noAlt = await uploadPhoto(request, browser, `[UJI]-tanpa-alt-${id}.jpg`, null, 9);
    const rejected = await request.patch(`/api/admin/categories/${category.id}`, { headers: HEADERS, data: { imageId: noAlt } });
    expect(rejected.status()).toBe(422);
    expect(((await rejected.json()) as { error: { fields: Record<string, string[]> } }).error.fields.imageId).toBeTruthy();

    categoryImage = await uploadPhoto(request, browser, `[UJI]-kategori-${id}.jpg`, CATEGORY_ALT, 13);
    const saved = await request.patch(`/api/admin/categories/${category.id}`, { headers: HEADERS, data: { imageId: categoryImage } });
    expect(saved.status(), await saved.text()).toBe(200);
    expect(((await saved.json()) as { data: { image: { id: string } | null } }).data.image?.id).toBe(categoryImage);
  });

  test("API publik: sampul sendiri = training, sampul kosong = category dengan alt media kategori", async ({ request }) => {
    await expect
      .poll(async () => (await publicCards(request, `Ikut kategori ${id}`))[0]?.coverSource)
      .toBe("category");
    const [fallback] = await publicCards(request, `Ikut kategori ${id}`);
    expect(fallback.cover?.alt).toBe(CATEGORY_ALT);
    const [own] = await publicCards(request, `Gambar sendiri ${id}`);
    expect(own).toMatchObject({ coverSource: "training", cover: { alt: "[UJI] Foto sampul sendiri" } });

    const detail = await request.get(`/api/public/trainings/${withoutCover.slug}`);
    expect(((await detail.json()) as { data: CardJson }).data).toMatchObject({ coverSource: "category", cover: { alt: CATEGORY_ALT } });
  });

  test("katalog & landing kategori: kartu tanpa sampul memakai gambar kategori", async ({ page }) => {
    for (const url of [`/pelatihan?q=${encodeURIComponent(id)}`, `/pelatihan/kategori/${category.slug}`]) {
      await expect
        .poll(async () => {
          await page.goto(url);
          return card(page, withoutCover.title).getAttribute("data-cover-source");
        })
        .toBe("category");
      await expect(card(page, withoutCover.title).getByRole("img", { name: CATEGORY_ALT })).toHaveCount(1);
      await expect(card(page, withCover.title)).toHaveAttribute("data-cover-source", "training");
    }
  });

  test("landing kategori: foto lebar ber-Viewfinder dengan label HUD nama kategori", async ({ page }) => {
    await page.goto(`/pelatihan/kategori/${category.slug}`);
    const photo = page.locator("[data-category-image]");
    await expect(photo).toBeVisible();
    await expect(photo.getByRole("img", { name: CATEGORY_ALT })).toBeVisible();
    await expect(photo).toContainText(new RegExp(`Kategori / ${category.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i"));
  });

  test("detail: gambar kategori tampil sebagai foto ber-Viewfinder dengan alt media kategori", async ({ page }) => {
    await page.goto(`/pelatihan/${withoutCover.slug}`);
    const photo = page.locator("[data-training-cover]");
    await expect(photo).toHaveAttribute("data-cover-source", "category");
    await expect(photo.getByRole("img", { name: CATEGORY_ALT })).toBeVisible();
  });

  test("media yang dipakai kategori tidak bisa dihapus (MEDIA_IN_USE)", async ({ page }) => {
    const request = page.request;
    await loginViaApi(request);
    const response = await request.delete(`/api/admin/media/${categoryImage}`, { headers: HEADERS });
    expect(response.status()).toBe(409);
    const body = (await response.json()) as { error: { code: string; details: { usages: { entity: string; label: string }[] } } };
    expect(body.error.code).toBe("MEDIA_IN_USE");
    expect(body.error.details.usages).toContainEqual(expect.objectContaining({ entity: "Category", label: category.name }));
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

  test("screenshot katalog & landing kategori dengan gambar kategori", async ({ page }) => {
    const out = process.env.SCREENS_OUT;
    test.skip(!out, "Butuh SCREENS_OUT.");
    const dir = out ?? "";
    mkdirSync(dir, { recursive: true });
    for (const width of [360, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      for (const [name, url] of [
        ["katalog-gambar-kategori", `/pelatihan?kategori=${category.slug}`],
        ["landing-gambar-kategori", `/pelatihan/kategori/${category.slug}`],
      ] as const) {
        await page.goto(url);
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
  });
});
