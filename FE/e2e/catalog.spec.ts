import { expect, test, type APIRequestContext } from "@playwright/test";
import { createTraining, deleteTraining, firstCategory, loginViaApi, runId, type CreatedTraining } from "./helpers";

// Alur kritis Fase 2: pelatihan dari admin tampil di katalog & detail publik < 5 detik,
// draft tidak tampil, search, filter di URL, 404 sungguhan, pratinjau draft khusus admin.

const PUBLISH_DEADLINE_MS = 5_000;
const created: CreatedTraining[] = [];

async function cleanup(request: APIRequestContext) {
  for (const training of created.splice(0)) await deleteTraining(request, training.id);
}

test.describe("katalog & detail pelatihan", () => {
  test.afterEach(async ({ page }) => {
    await cleanup(page.request);
  });

  test("admin membuat & menayangkan pelatihan, tampil di katalog dan detail < 5 detik, lalu judul diubah", async ({
    page,
  }) => {
    await loginViaApi(page.request);
    const category = await firstCategory(page.request);
    const id = runId();
    const title = `Pelatihan E2E Tayang ${id}`;

    await page.goto("/admin/trainings/new");
    await page.locator("#training-title").fill(title);
    await page.locator("#training-summary").fill(`Ringkasan pelatihan uji ${id}.`);
    await page.getByPlaceholder("Cari kategori").fill(category.name);
    await page.getByRole("checkbox", { name: category.name, exact: true }).click();
    // Status Tayang wajib 4 hasil belajar.
    for (let index = 1; index <= 4; index += 1) {
      await page.getByRole("button", { name: "Tambah hasil belajar" }).click();
      await page.getByLabel(`Hasil belajar ${index}`, { exact: true }).fill(`Hasil belajar uji ${index}`);
    }
    await page.getByRole("radio", { name: /Tayang/ }).check();
    await page.getByRole("button", { name: "Simpan", exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/trainings\/[0-9a-f-]{36}$/);
    const trainingId = page.url().split("/").pop() ?? "";
    const saved = await (await page.request.get(`/api/admin/trainings/${trainingId}`)).json();
    const slug: string = saved.data.slug;
    created.push({ id: trainingId, slug, title });
    expect(saved.data.publicState).toBe("PUBLISHED");

    // Sejak tersimpan: halaman publik (detail + katalog) harus menampilkan judul < 5 detik.
    const savedAt = Date.now();
    await expect
      .poll(async () => (await page.request.get(`/pelatihan/${slug}`)).status(), { timeout: PUBLISH_DEADLINE_MS })
      .toBe(200);
    await expect
      .poll(async () => (await (await page.request.get(`/pelatihan?q=${encodeURIComponent(id)}`)).text()).includes(title), {
        timeout: PUBLISH_DEADLINE_MS,
      })
      .toBe(true);
    expect(Date.now() - savedAt).toBeLessThan(PUBLISH_DEADLINE_MS);

    await page.goto(`/pelatihan/${slug}`);
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();

    // Ubah judul di admin: halaman publik ikut berubah < 5 detik tanpa redeploy.
    const renamed = `${title} Edisi Baru`;
    await page.goto(`/admin/trainings/${trainingId}`);
    await page.locator("#training-title").fill(renamed);
    await page.getByRole("button", { name: "Simpan", exact: true }).click();
    await expect(page.getByText(/Pelatihan disimpan/).first()).toBeVisible();
    const renamedAt = Date.now();
    await expect
      .poll(async () => (await (await page.request.get(`/pelatihan/${slug}`)).text()).includes(renamed), {
        timeout: PUBLISH_DEADLINE_MS,
      })
      .toBe(true);
    expect(Date.now() - renamedAt).toBeLessThan(PUBLISH_DEADLINE_MS);
  });

  test("draft tidak tampil di publik; pratinjau hanya untuk admin", async ({ page, browser }) => {
    await loginViaApi(page.request);
    const category = await firstCategory(page.request);
    const id = runId();
    const draft = await createTraining(page.request, {
      title: `Draf E2E ${id}`,
      summary: `Ringkasan draf ${id}`,
      categoryIds: [category.id],
      status: "DRAFT",
    });
    created.push(draft);

    // Pengunjung (konteks terpisah tanpa sesi): 404 dan tidak muncul di pencarian.
    const visitor = await browser.newContext();
    const response = await visitor.request.get(`/pelatihan/${draft.slug}`);
    expect(response.status()).toBe(404);
    const search = await visitor.request.get(`/pelatihan?q=${encodeURIComponent(id)}`);
    expect(await search.text()).not.toContain(draft.title);
    // Route pratinjau tanpa sesi diarahkan ke login, bukan menampilkan draf.
    const visitorPage = await visitor.newPage();
    await visitorPage.goto(`/admin/preview?type=training&id=${draft.id}`);
    await expect(visitorPage).toHaveURL(/\/admin\/login/);
    await visitor.close();

    // Admin: pratinjau lewat draft mode.
    await page.goto(`/admin/preview?type=training&id=${draft.id}`);
    await expect(page).toHaveURL(new RegExp(`/pelatihan/${draft.slug}$`));
    await expect(page.getByText("Mode pratinjau")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: draft.title })).toBeVisible();
    await page.getByRole("button", { name: "Keluar dari pratinjau" }).click();
    await expect
      .poll(async () => (await page.request.get(`/pelatihan/${draft.slug}`)).status())
      .toBe(404);
  });

  test("search menemukan pelatihan dari kata di ringkasan", async ({ page }) => {
    await loginViaApi(page.request);
    const category = await firstCategory(page.request);
    const word = `zebra${runId()}`;
    const training = await createTraining(page.request, {
      title: `Pelatihan Pencarian ${runId()}`,
      summary: `Materi khusus tentang ${word} untuk uji pencarian.`,
      categoryIds: [category.id],
      status: "PUBLISHED",
    });
    created.push(training);

    await page.goto("/pelatihan");
    await page.getByRole("searchbox", { name: "Cari pelatihan" }).fill(word);
    await page.getByRole("button", { name: "Cari", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`q=${word}`));
    await expect(page.getByRole("link", { name: training.title })).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "pelatihan" })).toContainText("1");
  });

  test("filter tersimpan di URL dan bisa dibuka ulang", async ({ page, context }) => {
    await page.goto("/pelatihan");
    // Chip ke-2 di grup Kategori (chip pertama = "Semua").
    const categoryChip = page.getByRole("group", { name: "Kategori" }).getByRole("link").nth(1);
    const categoryHref = (await categoryChip.getAttribute("href")) ?? "";
    const categorySlug = new URLSearchParams(categoryHref.split("?")[1]).get("kategori") ?? "";
    // Nama tanpa angka jumlah di ujung (jumlah bisa berubah karena test lain).
    const categoryName = (await categoryChip.innerText()).replace(/\s*\d+$/, "");
    await categoryChip.click();
    await expect(page).toHaveURL(new RegExp(`kategori=${categorySlug}`));
    await page.getByRole("group", { name: "Metode" }).getByRole("link", { name: "Offline" }).click();
    await expect(page).toHaveURL(/metode=offline/);
    await page.getByRole("navigation", { name: "Urutkan" }).getByRole("link", { name: "A-Z" }).click();
    await expect(page).toHaveURL(/urut=az/);

    // URL yang sama dibuka di tab baru: filter yang sama aktif.
    const url = page.url();
    expect(url).toContain(`kategori=${categorySlug}&metode=offline&urut=az`);
    const reopened = await context.newPage();
    await reopened.goto(url);
    const activeCategory = reopened.getByRole("group", { name: "Kategori" }).locator('a[aria-current="true"]');
    await expect(activeCategory).toHaveCount(1);
    await expect(activeCategory).toContainText(categoryName);
    await expect(reopened.getByRole("group", { name: "Metode" }).getByRole("link", { name: "Offline" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    await expect(reopened.getByRole("navigation", { name: "Urutkan" }).getByRole("link", { name: "A-Z" })).toHaveAttribute(
      "aria-current",
      "true",
    );
  });

  test("slug yang tidak ada mengembalikan HTTP 404 sungguhan", async ({ request }) => {
    const missing = `tidak-ada-${runId()}`;
    expect((await request.get(`/pelatihan/${missing}`)).status()).toBe(404);
    // Permintaan kedua (dari cache) tetap 404.
    expect((await request.get(`/pelatihan/${missing}`)).status()).toBe(404);
    expect((await request.get(`/pelatihan/kategori/${missing}`)).status()).toBe(404);
  });
});
