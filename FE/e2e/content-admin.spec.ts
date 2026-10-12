import { readFile } from "node:fs/promises";
import path from "node:path";
import { expect, test, type APIRequestContext, type Locator, type Page } from "@playwright/test";
import { loginViaApi, ORIGIN, runId } from "./helpers";

// Uji UI modul konten pendukung (3.2b): buat, ubah, urutkan (keyboard), hapus + "Urungkan",
// guard dialog, error field dari API, galeri portofolio, ReorderPanel kategori.
// Data uji berawalan [UJI].

const HEADERS = { Origin: ORIGIN };

async function uploadImage(request: APIRequestContext, name: string, alt: string | null): Promise<string> {
  const buffer = await readFile(path.join(__dirname, "fixtures", "sample.png"));
  const response = await request.post("/api/admin/media", {
    headers: HEADERS,
    multipart: { files: { name, mimeType: "image/png", buffer }, folder: "uji" },
  });
  expect(response.status(), await response.text()).toBe(201);
  const id = ((await response.json()) as { data: { created: { id: string }[] } }).data.created[0].id;
  if (alt) expect((await request.patch(`/api/admin/media/${id}`, { headers: HEADERS, data: { alt } })).status()).toBe(200);
  return id;
}

async function get<T>(request: APIRequestContext, url: string): Promise<{ status: number; data: T }> {
  const response = await request.get(`/api${url}`);
  const body = (await response.json().catch(() => ({}))) as { data: T };
  return { status: response.status(), data: body.data };
}

const field = (scope: Page | Locator, name: string) => scope.getByRole("textbox", { name, exact: true });
const toast = (page: Page, text: string | RegExp) =>
  expect(page.locator("[data-sonner-toast]").filter({ hasText: text }).first()).toBeVisible();

async function moveUp(page: Page, label: string) {
  await page.getByRole("button", { name: `Ubah urutan ${label}`, exact: true }).focus();
  await page.keyboard.press("Space");
  await page.waitForTimeout(200);
  await page.keyboard.press("ArrowUp");
  await page.waitForTimeout(200);
  await page.keyboard.press("Space");
}

// Pilih media lewat dialog picker (tombol dicari lewat teksnya karena nama aksesibelnya = label).
async function pickMedia(page: Page, buttonText: string, fileName: string, scope: Page | Locator = page) {
  await scope.locator("button", { hasText: buttonText }).first().click();
  const dialog = page.getByRole("dialog").filter({ has: page.getByRole("button", { name: /^Pakai / }) });
  await dialog.getByRole("searchbox").fill(fileName.replace(/\.png$/, ""));
  await dialog.getByRole("button", { name: `Pilih ${fileName}`, exact: true }).click();
  await dialog.getByRole("button", { name: /^Pakai / }).click();
  await expect(page.getByRole("button", { name: /^Pakai / })).toHaveCount(0);
}

const order = async (request: APIRequestContext, resource: string) =>
  (await get<{ id: string }[]>(request, `/admin/${resource}?sort=order&pageSize=100`)).data.map((row) => row.id);

test.describe("konten pendukung", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaApi(page.request);
  });

  test("layanan: alt wajib, pratinjau nonaktif saat dirty, urutkan, hapus + urungkan", async ({ page }) => {
    const id = runId();
    const noAlt = `[UJI]-layanan-tanpa-alt-${id}.png`;
    const withAlt = `[UJI]-layanan-${id}.png`;
    await uploadImage(page.request, noAlt, null);
    await uploadImage(page.request, withAlt, "[UJI] gambar layanan");

    await page.goto("/admin/services/new");
    await field(page, "Judul").fill(`[UJI] Layanan A ${id}`);
    await field(page, "Ringkasan").fill("Ringkasan layanan uji.");
    await page.getByText("Tayang", { exact: true }).click();
    await pickMedia(page, "Pilih gambar", noAlt);
    await page.getByRole("button", { name: "Simpan", exact: true }).click();
    await expect(page.getByText("Gambar belum punya teks alt. Isi alt di media library dulu.")).toBeVisible();

    await pickMedia(page, "Ganti gambar", withAlt);
    await page.getByRole("button", { name: "Simpan", exact: true }).click();
    await page.waitForURL(/\/admin\/services\/[0-9a-f-]{36}$/);
    await toast(page, "Layanan disimpan dan tayang");
    const idA = page.url().split("/").pop() ?? "";

    await expect(page.getByRole("link", { name: /Pratinjau/ })).toBeVisible();
    await field(page, "Judul").fill(`[UJI] Layanan A ${id} (ubah)`);
    await expect(page.getByRole("button", { name: /Pratinjau/ })).toBeDisabled();
    await page.getByRole("button", { name: "Simpan", exact: true }).click();
    await toast(page, "Layanan disimpan dan tayang");
    await expect(page.getByRole("link", { name: /Pratinjau/ })).toBeVisible();

    await page.goto("/admin/services/new");
    await field(page, "Judul").fill(`[UJI] Layanan B ${id}`);
    await page.getByRole("button", { name: "Simpan", exact: true }).click();
    await page.waitForURL(/\/admin\/services\/[0-9a-f-]{36}$/);
    const idB = page.url().split("/").pop() ?? "";

    await page.goto("/admin/services");
    await page.getByRole("button", { name: "Urutkan" }).click();
    await moveUp(page, `[UJI] Layanan B ${id}`);
    await toast(page, "Urutan layanan disimpan");
    const ids = await order(page.request, "services");
    expect(ids.indexOf(idB)).toBeLessThan(ids.indexOf(idA));

    await page.goto(`/admin/services/${idB}`);
    await page.getByRole("button", { name: "Hapus layanan" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Hapus", exact: true }).click();
    await page.waitForURL(/\/admin\/services$/);
    await toast(page, "dipindahkan ke Sampah");
    expect((await get(page.request, `/admin/services/${idB}`)).status).toBe(404);
    await page.locator("[data-sonner-toast]").getByRole("button", { name: "Urungkan" }).click();
    await toast(page, "dipulihkan");
    expect((await get(page.request, `/admin/services/${idB}`)).status).toBe(200);
  });

  const DIALOG_ENTITIES = [
    { resource: "clients", noun: "klien", title: "Klien" },
    { resource: "testimonials", noun: "testimoni", title: "Testimoni" },
    { resource: "marketing", noun: "kontak marketing", title: "Marketing" },
    { resource: "media-partners", noun: "media partner", title: "Media partner" },
  ] as const;

  for (const entity of DIALOG_ENTITIES) {
    test(`${entity.resource}: dialog + guard, urutkan, hapus + urungkan`, async ({ page }) => {
      const id = runId();
      const names = [`[UJI] ${entity.title} A ${id}`, `[UJI] ${entity.title} B ${id}`];
      await page.goto(`/admin/${entity.resource}`);

      for (const name of names) {
        await page.getByRole("button", { name: `Tambah ${entity.noun}`, exact: true }).first().click();
        const dialog = page.getByRole("dialog");
        await field(dialog, "Nama").fill(name);
        if (entity.resource === "testimonials") await field(dialog, "Testimoni").fill("Materinya aplikatif. (data uji)");
        if (entity.resource === "marketing") {
          // Nomor terlalu pendek lolos validasi FE, ditolak BE: error tampil di field.
          await field(dialog, "Nomor WhatsApp").fill("0812");
          await dialog.getByRole("button", { name: "Simpan", exact: true }).click();
          await expect(dialog.getByText("Nomor WhatsApp tidak valid. Contoh: +62 812 3456 7890.")).toBeVisible();
          await field(dialog, "Nomor WhatsApp").fill("0812 0000 0001");
        }
        await dialog.getByRole("button", { name: "Simpan", exact: true }).click();
        await toast(page, "ditambahkan");
        await expect(page.getByRole("dialog")).toHaveCount(0);
      }
      const rows = (await get<{ id: string; name: string }[]>(page.request, `/admin/${entity.resource}?q=${id}&pageSize=10`)).data;
      const rowA = rows.find((row) => row.name === names[0]);
      const rowB = rows.find((row) => row.name === names[1]);
      expect(rowA && rowB).toBeTruthy();

      // Esc dengan perubahan -> konfirmasi; "Lanjut mengedit" mempertahankan isi.
      await page.getByRole("button", { name: `Ubah ${names[0]}`, exact: true }).click();
      await field(page.getByRole("dialog"), "Nama").fill(`${names[0]} (ubah)`);
      await page.keyboard.press("Escape");
      await expect(page.getByRole("alertdialog").getByText("Buang perubahan?")).toBeVisible();
      await page.getByRole("alertdialog").getByRole("button", { name: "Lanjut mengedit" }).click();
      await expect(field(page.getByRole("dialog"), "Nama")).toHaveValue(`${names[0]} (ubah)`);
      await page.getByRole("dialog").getByRole("button", { name: "Simpan", exact: true }).click();
      await toast(page, "disimpan");

      // Batal + Buang perubahan tidak menyimpan.
      await page.getByRole("button", { name: `Ubah ${names[1]}`, exact: true }).click();
      await field(page.getByRole("dialog"), "Nama").fill("[UJI] tidak boleh tersimpan");
      await page.getByRole("dialog").getByRole("button", { name: "Batal" }).click();
      await page.getByRole("alertdialog").getByRole("button", { name: "Buang perubahan" }).click();
      expect((await get<{ name: string }>(page.request, `/admin/${entity.resource}/${rowB!.id}`)).data.name).toBe(names[1]);

      await page.getByRole("button", { name: "Urutkan" }).click();
      await moveUp(page, names[1]);
      await toast(page, `Urutan ${entity.noun} disimpan`);
      const ids = await order(page.request, entity.resource);
      expect(ids.indexOf(rowB!.id)).toBeLessThan(ids.indexOf(rowA!.id));
      await page.getByRole("button", { name: "Selesai mengurutkan" }).click();

      await page.getByRole("button", { name: `Hapus ${names[1]}`, exact: true }).click();
      await page.getByRole("alertdialog").getByRole("button", { name: "Hapus", exact: true }).click();
      await toast(page, "dipindahkan ke Sampah");
      await page.locator("[data-sonner-toast]").getByRole("button", { name: "Urungkan" }).click();
      await toast(page, "dipulihkan");
      expect((await get(page.request, `/admin/${entity.resource}/${rowB!.id}`)).status).toBe(200);
    });
  }

  test("portofolio: galeri dengan alt wajib per index, urutkan galeri, link isi alt", async ({ page, context }) => {
    const id = runId();
    const files = [`[UJI]-galeri-1-${id}.png`, `[UJI]-galeri-tanpa-alt-${id}.png`, `[UJI]-galeri-2-${id}.png`];
    const mediaIds = [
      await uploadImage(page.request, files[0], "[UJI] galeri satu"),
      await uploadImage(page.request, files[1], null),
      await uploadImage(page.request, files[2], "[UJI] galeri dua"),
    ];

    await page.goto("/admin/portfolio/new");
    await field(page, "Judul").fill(`[UJI] Portofolio ${id}`);
    for (const file of files) await pickMedia(page, "Tambah gambar", file);
    await expect(page.getByText("Belum punya alt text, wajib sebelum disimpan.")).toBeVisible();
    const href = await page.getByRole("link", { name: /Isi alt di media library/ }).getAttribute("href");
    expect(href).toBe(`/admin/media?media=${mediaIds[1]}`);

    await page.getByRole("button", { name: "Simpan", exact: true }).click();
    await expect(page.getByText("Gambar belum punya teks alt. Isi alt di media library dulu.")).toBeVisible();

    await moveUp(page, "gambar 3");
    await page.getByRole("button", { name: "Lepas gambar 3" }).click();
    await page.getByRole("button", { name: "Simpan", exact: true }).click();
    await page.waitForURL(/\/admin\/portfolio\/[0-9a-f-]{36}$/);
    const saved = await get<{ imageIds: string[] }>(page.request, `/admin/portfolio/${page.url().split("/").pop()}`);
    expect(saved.data.imageIds).toEqual([mediaIds[0], mediaIds[2]]);

    const mediaPage = await context.newPage();
    await mediaPage.goto(href ?? "/admin/media");
    await expect(mediaPage.getByRole("dialog").getByText(files[1]).first()).toBeVisible();
    await mediaPage.close();
  });

  test("kategori: ReorderPanel memindah urutan lalu dikembalikan", async ({ page }) => {
    const before = (await get<{ id: string; name: string }[]>(page.request, "/admin/categories/options")).data;
    test.skip(before.length < 2, "Butuh minimal 2 kategori (seed).");
    await page.goto("/admin/categories");
    await page.getByRole("button", { name: "Urutkan" }).click();
    await moveUp(page, before[1].name);
    await toast(page, "Urutan kategori disimpan");
    expect((await get<{ id: string }[]>(page.request, "/admin/categories/options")).data[0].id).toBe(before[1].id);
    await moveUp(page, before[0].name);
    await expect
      .poll(async () => (await get<{ id: string }[]>(page.request, "/admin/categories/options")).data.map((row) => row.id))
      .toEqual(before.map((row) => row.id));
  });
});
