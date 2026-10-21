import { expect, test, type APIRequestContext } from "@playwright/test";
import { createTraining, loginViaApi, ORIGIN, runId, type CreatedTraining } from "./helpers";

// Alat merapikan kategori di admin: kata kunci + "Pelatihan yang cocok" (penautan manual),
// gabungkan kategori kembar, dan hapus kategori yang masih dipakai (lepas tautan dulu).
// Data uji hanya di database training_e2e (direset tiap run).

const HEADERS = { Origin: ORIGIN };

test.describe.configure({ mode: "serial" });

type Ref = { id: string; slug: string; name: string };

async function createCategory(request: APIRequestContext, name: string): Promise<Ref> {
  const response = await request.post("/api/admin/categories", { headers: HEADERS, data: { name } });
  expect(response.status(), await response.text()).toBe(201);
  return ((await response.json()) as { data: Ref }).data;
}

async function trainingCategories(request: APIRequestContext, id: string): Promise<string[]> {
  const response = await request.get(`/api/admin/trainings/${id}`);
  expect(response.status()).toBe(200);
  return ((await response.json()) as { data: { categories: { id: string }[] } }).data.categories.map((item) => item.id);
}

test.describe("alat kategori", () => {
  const id = runId();
  const keyword = `zebrafoto${id}`;
  let base: Ref;
  let target: Ref;
  let twin: Ref;
  let lonely: Ref;
  let matching: CreatedTraining;
  let twinTraining: CreatedTraining;
  let onlyLonely: CreatedTraining;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ baseURL: ORIGIN });
    const request = context.request;
    await loginViaApi(request);
    base = await createCategory(request, `[UJI] Basis ${id}`);
    target = await createCategory(request, `[UJI] Tujuan ${id}`);
    twin = await createCategory(request, `[UJI] Kembar ${id}`);
    lonely = await createCategory(request, `[UJI] Sendiri ${id}`);
    matching = await createTraining(request, { title: `[UJI] Pelatihan ${keyword} dasar`, categoryIds: [base.id] });
    await createTraining(request, { title: `[UJI] Pelatihan ${keyword}lanjut`, categoryIds: [base.id] });
    twinTraining = await createTraining(request, { title: `[UJI] Kelas kembar ${id}`, categoryIds: [base.id, twin.id] });
    onlyLonely = await createTraining(request, { title: `[UJI] Hanya satu kategori ${id}`, categoryIds: [lonely.id] });
    await context.close();
  });

  test("kata kunci: daftar pelatihan yang cocok (kata utuh) lalu ditautkan manual", async ({ page }) => {
    await loginViaApi(page.request);
    await page.goto(`/admin/categories/${target.id}`);
    await expect(page.getByText("Tambahkan kata kunci di atas lalu simpan")).toBeVisible();

    // Search global admin (combobox) juga berlabel "Kata kunci".
    const input = page.getByRole("textbox", { name: "Kata kunci", exact: true });
    await input.fill(keyword);
    await input.press("Enter");
    await expect(page.getByRole("button", { name: `Hapus kata kunci ${keyword}` })).toBeVisible();
    await page.getByRole("button", { name: "Simpan", exact: true }).click();
    await expect(page.getByText("Kategori disimpan.").first()).toBeVisible();

    const panel = page.getByRole("region", { name: "Pelatihan yang cocok" });
    // "...dasar" cocok sebagai kata utuh; "...lanjut" (kata menempel) tidak.
    await expect(panel.getByRole("listitem")).toHaveCount(1);
    await expect(panel.getByText(matching.title)).toBeVisible();
    await expect(panel.getByText(`Kategori: ${base.name}`)).toBeVisible();
    await expect(panel.getByRole("button", { name: "Tautkan", exact: true })).toBeDisabled();

    await panel.getByLabel(matching.title).check();
    await panel.getByRole("button", { name: "Tautkan 1 pelatihan" }).click();
    await expect(page.getByText(`1 pelatihan ditautkan ke ${target.name}.`).first()).toBeVisible();
    await expect(panel.getByText("Semua 1 pelatihan yang cocok sudah ada di kategori ini.")).toBeVisible();
    // Hanya menambah: kategori lama tetap.
    expect((await trainingCategories(page.request, matching.id)).sort()).toEqual([base.id, target.id].sort());
  });

  test("gabungkan kategori kembar ke tujuan", async ({ page }) => {
    await loginViaApi(page.request);
    await page.goto(`/admin/categories/${twin.id}`);
    await page.getByRole("button", { name: "Gabungkan ke kategori lain" }).click();
    const dialog = page.getByRole("alertdialog");
    await dialog.getByRole("button", { name: "Gabungkan", exact: true }).click();
    await expect(dialog.getByText("Pilih kategori tujuan.")).toBeVisible();

    await dialog.getByRole("button", { name: "Pilih kategori tujuan" }).click();
    await page.getByLabel("Cari nama atau slug kategori").fill(target.name);
    await page.getByRole("button", { name: new RegExp(target.name.replace(/[[\]]/g, "\\$&")) }).click();
    await dialog.getByRole("button", { name: "Gabungkan", exact: true }).click();

    await expect(page).toHaveURL(new RegExp(`/admin/categories/${target.id}$`));
    await expect(page.getByText(`"${twin.name}" digabung ke "${target.name}". 1 tautan pelatihan dipindah.`).first()).toBeVisible();
    expect((await page.request.get(`/api/admin/categories/${twin.id}`)).status()).toBe(404);
    expect((await trainingCategories(page.request, twinTraining.id)).sort()).toEqual([base.id, target.id].sort());
    // URL lama dialihkan ke kategori tujuan.
    const old = await page.request.get(`/pelatihan/kategori/${twin.slug}`, { maxRedirects: 0 });
    expect([301, 308]).toContain(old.status());
    expect(old.headers().location).toContain(`/pelatihan/kategori/${target.slug}`);
  });

  test("hapus kategori yang dipakai: tautan dilepas, pelatihan tetap di kategori lain", async ({ page }) => {
    await loginViaApi(page.request);
    await page.goto(`/admin/categories/${target.id}`);
    await expect(page.getByText("Dipakai 2 pelatihan.")).toBeVisible();
    await page.getByRole("button", { name: "Hapus kategori" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Lepas dan hapus" }).click();
    await expect(page).toHaveURL(/\/admin\/categories$/);
    await expect(page.getByText("Kategori dipindahkan ke Sampah.").first()).toBeVisible();
    expect(await trainingCategories(page.request, matching.id)).toEqual([base.id]);
    expect(await trainingCategories(page.request, twinTraining.id)).toEqual([base.id]);
  });

  test("hapus ditolak kalau ada pelatihan yang jadi tanpa kategori", async ({ page }) => {
    await loginViaApi(page.request);
    await page.goto(`/admin/categories/${lonely.id}`);
    await page.getByRole("button", { name: "Hapus kategori" }).click();
    const dialog = page.getByRole("alertdialog");
    await dialog.getByRole("button", { name: "Lepas dan hapus" }).click();
    await expect(dialog.getByRole("alert")).toContainText("1 pelatihan hanya punya kategori ini");
    await expect(dialog.getByRole("link", { name: onlyLonely.title })).toBeVisible();
    expect((await page.request.get(`/api/admin/categories/${lonely.id}`)).status()).toBe(200);
    expect(await trainingCategories(page.request, onlyLonely.id)).toEqual([lonely.id]);
  });
});
