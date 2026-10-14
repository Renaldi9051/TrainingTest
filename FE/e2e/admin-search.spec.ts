import { expect, test, type Page } from "@playwright/test";
import { createTraining, deleteTraining, firstCategory, loginViaApi, ORIGIN, runId, type CreatedTraining } from "./helpers";

// Search global admin (4.4b): Ctrl/Cmd+K, hasil BE + field pengaturan, deep link, editor Tiptap,
// guard perubahan belum disimpan, dan proteksi endpoint. Data uji berawalan [UJI].

const HEADERS = { Origin: ORIGIN };

const palette = (page: Page) => page.getByRole("dialog", { name: "Cari di panel admin" });
const searchInput = (page: Page) => palette(page).getByRole("combobox", { name: "Kata kunci" });

// Tombol & shortcut baru aktif setelah hidrasi (HTML server sudah tampil lebih dulu). Tekan lagi hanya
// kalau palette belum terbuka, supaya tidak menutupnya kembali; tetap gagal kalau shortcut rusak.
async function openWith(page: Page, open: () => Promise<void>) {
  await expect(async () => {
    if (!(await palette(page).isVisible())) await open();
    await expect(palette(page)).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
}

const openWithShortcut = (page: Page) => openWith(page, () => page.keyboard.press("ControlOrMeta+K"));

// Pilih hasil dengan panah bawah (seperti admin) sampai opsi tujuan aktif.
async function selectWithArrows(page: Page, name: RegExp) {
  const option = palette(page).getByRole("option", { name });
  await expect(option).toBeVisible();
  for (let step = 0; step < 15 && (await option.getAttribute("aria-selected")) !== "true"; step += 1) {
    await searchInput(page).press("ArrowDown");
  }
  await expect(option).toHaveAttribute("aria-selected", "true");
}

// Editor rich text baru dirender setelah hidrasi: tanda form siap dipakai.
async function gotoTrainingForm(page: Page, trainingId: string) {
  await page.goto(`/admin/trainings/${trainingId}`);
  await expect(page.getByRole("textbox", { name: "Deskripsi", exact: true })).toBeVisible();
}

test.describe.configure({ mode: "serial" });
test.describe("search global admin", () => {
  const id = runId();
  let draft: CreatedTraining;
  let trashed: CreatedTraining;
  let clientId = "";
  // Token sendiri: kata kunci klien tidak boleh mirip (trigram) dengan judul pelatihan draf uji.
  const clientToken = runId();
  const clientName = `[UJI] Klien ${clientToken}`;

  test.beforeAll(async ({ request }) => {
    await loginViaApi(request);
    const category = await firstCategory(request);
    draft = await createTraining(request, { title: `[UJI] Palette draf ${id}`, categoryIds: [category.id], status: "DRAFT" });
    trashed = await createTraining(request, { title: `[UJI] Palette sampah ${id}`, categoryIds: [category.id], status: "DRAFT" });
    await deleteTraining(request, trashed.id);
    const response = await request.post("/api/admin/clients", { headers: HEADERS, data: { name: clientName } });
    expect(response.status(), await response.text()).toBe(201);
    clientId = ((await response.json()) as { data: { id: string } }).data.id;
  });

  test.afterAll(async ({ request }) => {
    if (draft) await deleteTraining(request, draft.id);
    if (clientId) await request.delete(`/api/admin/clients/${clientId}`, { headers: HEADERS });
  });

  test.beforeEach(async ({ page }) => {
    await loginViaApi(page.request);
  });

  test("endpoint: 401 tanpa sesi, 422 kata kunci terlalu pendek, draf ikut, Sampah tidak", async ({ page, playwright }) => {
    const anonymous = await playwright.request.newContext({ baseURL: ORIGIN });
    expect((await anonymous.get("/api/admin/search?q=palette")).status()).toBe(401);
    await anonymous.dispose();

    expect((await page.request.get("/api/admin/search?q=a")).status()).toBe(422);
    const response = await page.request.get(`/api/admin/search?q=${encodeURIComponent(`palette ${id}`)}`);
    expect(response.status()).toBe(200);
    const { data } = (await response.json()) as { data: { groups: { group: string; items: { id: string; status: string | null }[] }[] } };
    const trainings = data.groups.find((group) => group.group === "trainings")?.items ?? [];
    expect(trainings).toContainEqual(expect.objectContaining({ id: draft.id, status: "DRAFT" }));
    expect(trainings.map((item) => item.id)).not.toContain(trashed.id);
  });

  test("Ctrl/Cmd+K membuka palette, draf ketemu dengan badge, Enter membuka halaman edit", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.getByRole("button", { name: /Cari/ })).toBeVisible();
    await openWithShortcut(page);
    await searchInput(page).fill(`Palette draf ${id}`);
    const option = palette(page).getByRole("option", { name: new RegExp(`Palette draf ${id}`) });
    await expect(option).toContainText("Draf");
    await expect(option).toHaveAttribute("aria-selected", "true");
    await searchInput(page).press("Enter");
    await expect(page).toHaveURL(new RegExp(`/admin/trainings/${draft.id}$`));
    await expect(palette(page)).toBeHidden();
  });

  test("'nomor wa' membuka tab Kontak dan memfokuskan WhatsApp; lompat lagi di halaman yang sama", async ({ page }) => {
    await page.goto("/admin");
    await openWithShortcut(page);
    await searchInput(page).fill("nomor wa");
    await expect(palette(page).getByRole("option", { name: /WhatsApp/ })).toBeVisible();
    await searchInput(page).press("Enter");
    await expect(page).toHaveURL(/\/admin\/settings#field-site\.contact\.whatsapp$/);
    await expect(page.getByRole("tab", { name: "Kontak" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByLabel("WhatsApp", { exact: true })).toBeFocused();

    // Di halaman pengaturan sendiri: tab berganti dan field lain difokuskan.
    await openWithShortcut(page);
    await searchInput(page).fill("nama situs");
    await expect(palette(page).getByRole("option", { name: /Nama situs/ })).toBeVisible();
    await searchInput(page).press("Enter");
    await expect(page.getByRole("tab", { name: "Identitas" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByLabel("Nama situs")).toBeFocused();
  });

  test("Esc menutup palette dan fokus kembali ke tombol Cari", async ({ page }) => {
    await page.goto("/admin");
    const trigger = page.getByRole("button", { name: /Cari/ });
    await openWith(page, () => trigger.click());
    await expect(searchInput(page)).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(palette(page)).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("Ctrl/Cmd+K di editor Tiptap membuka popover tautan, bukan palette", async ({ page }) => {
    await gotoTrainingForm(page, draft.id);
    const editor = page.getByRole("textbox", { name: "Deskripsi", exact: true });
    await editor.click();
    await page.keyboard.press("ControlOrMeta+K");
    await expect(page.getByRole("textbox", { name: "URL tautan" })).toBeVisible();
    await expect(palette(page)).toBeHidden();
  });

  test("lompat dari palette saat form belum disimpan: guard muncul; batal = tetap, lanjut = dialog klien terbuka", async ({ page }) => {
    await gotoTrainingForm(page, draft.id);
    await page.getByRole("textbox", { name: "Judul", exact: true }).fill(`[UJI] Palette draf ${id} diubah`);
    await openWithShortcut(page);
    await searchInput(page).fill(`Klien ${clientToken}`);
    await selectWithArrows(page, new RegExp(`Klien ${clientToken}`));

    const messages: string[] = [];
    page.once("dialog", (dialog) => {
      messages.push(dialog.message());
      void dialog.dismiss();
    });
    await searchInput(page).press("Enter");
    await expect.poll(() => messages.length).toBe(1);
    expect(messages[0]).toContain("belum disimpan");
    await expect(page).toHaveURL(new RegExp(`/admin/trainings/${draft.id}$`));
    await expect(palette(page)).toBeVisible();

    page.once("dialog", (dialog) => void dialog.accept());
    await searchInput(page).press("Enter");
    await expect(page).toHaveURL(new RegExp(`/admin/clients\\?edit=${clientId}$`));
    const editDialog = page.getByRole("dialog", { name: "Ubah klien" });
    await expect(editDialog).toBeVisible();
    await expect(editDialog.getByLabel("Nama")).toHaveValue(clientName);

    // Menutup dialog menghapus ?edit= dari URL.
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/\/admin\/clients$/);
  });
});
