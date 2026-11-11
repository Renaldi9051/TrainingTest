import { expect, test } from "@playwright/test";
import { createTraining, deleteTraining, loginViaApi, ORIGIN, runId, type CreatedTraining } from "./helpers";

// Paginasi daftar pelatihan di landing kategori (pemilik, 11 Nov 2026): 20 judul per halaman di klien,
// hanya di section "Daftar pelatihan"; cari judul mencari di semua judul dan kembali ke halaman 1.
// Data uji hanya di training_e2e: kategori + 23 pelatihan dibuat per run lalu dihapus di akhir.

const HEADERS = { Origin: ORIGIN };
const TOTAL = 23;

test.describe.configure({ mode: "serial" });

const id = runId();
const pad = (n: number) => String(n).padStart(2, "0");
let category: { id: string; slug: string };
const trainings: CreatedTraining[] = [];

test.describe("paginasi daftar pelatihan kategori", () => {
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ baseURL: ORIGIN });
    const request = context.request;
    await loginViaApi(request);
    const created = await request.post("/api/admin/categories", {
      headers: HEADERS,
      data: { name: `[UJI] Paginasi ${id}` },
    });
    expect(created.status(), await created.text()).toBe(201);
    category = ((await created.json()) as { data: { id: string; slug: string } }).data;
    for (let n = 1; n <= TOTAL; n += 1) {
      trainings.push(
        await createTraining(request, {
          title: `[UJI] Halaman ${id} judul ${pad(n)}`,
          categoryIds: [category.id],
          status: "PUBLISHED",
        }),
      );
    }
    await context.close();
  });

  test.afterAll(async ({ browser }) => {
    const context = await browser.newContext({ baseURL: ORIGIN });
    const request = context.request;
    await loginViaApi(request);
    for (const training of trainings) await deleteTraining(request, training.id);
    if (category) await request.delete(`/api/admin/categories/${category.id}`, { headers: HEADERS });
    await context.close();
  });

  test("20 judul per halaman, berikutnya/sebelumnya, nomor berlanjut, cari kembali ke halaman 1", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const url = `/pelatihan/kategori/${category.slug}`;
    const list = page.getByRole("list", { name: "Judul pelatihan" });
    // Cache publik di-revalidate BE setelah mutasi; ulangi goto sampai semua judul terlihat.
    await expect
      .poll(async () => {
        await page.goto(url);
        return (await page.getByRole("heading", { level: 2, name: `${TOTAL} judul pelatihan` }).count()) > 0;
      })
      .toBe(true);

    const pager = page.locator("#daftar").getByRole("navigation", { name: "Halaman" });
    await expect(list.getByRole("link")).toHaveCount(20);
    await expect(list.getByRole("link").first()).toContainText(`judul 01`);
    await expect(page.locator("#daftar")).toContainText(`Halaman 1 dari 2 / 1-20 dari ${TOTAL}`);
    await expect(pager.getByRole("button", { name: "Halaman 1" })).toHaveAttribute("aria-current", "page");
    await expect(pager.getByRole("button", { name: "Sebelumnya" })).toHaveCount(0);

    await pager.getByRole("button", { name: "Berikutnya" }).click();
    await expect(list.getByRole("link")).toHaveCount(TOTAL - 20);
    await expect(list.getByRole("link").first()).toContainText("21");
    await expect(list.getByRole("link").first()).toContainText(`judul 21`);
    await expect(page.locator("#daftar")).toContainText(`Halaman 2 dari 2 / 21-${TOTAL} dari ${TOTAL}`);
    // Tombol "Berikutnya" hilang di halaman terakhir: fokus pindah ke judul daftar.
    await expect(page.getByRole("heading", { level: 2, name: `${TOTAL} judul pelatihan` })).toBeFocused();

    // Keyboard: tombol nomor halaman bisa dipakai lewat Enter.
    await pager.getByRole("button", { name: "Halaman 1" }).focus();
    await page.keyboard.press("Enter");
    await expect(list.getByRole("link").first()).toContainText(`judul 01`);

    await pager.getByRole("button", { name: "Halaman 2" }).click();
    await page.getByLabel("Cari judul pelatihan").fill(`judul 0`);
    await expect(list.getByRole("link")).toHaveCount(9);
    await expect(list.getByRole("link").first()).toContainText(`judul 01`);
    await expect(page.locator("#daftar").getByRole("navigation", { name: "Halaman" })).toHaveCount(0);

    await page.getByLabel("Cari judul pelatihan").fill("");
    await expect(list.getByRole("link")).toHaveCount(20);
  });
});
