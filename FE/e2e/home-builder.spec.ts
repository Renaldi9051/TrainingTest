import { readFile } from "node:fs/promises";
import path from "node:path";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { loginViaApi, ORIGIN, runId } from "./helpers";

// Builder beranda (3.4): tambah section per type, HERO/CTA satu instance (menu nonaktif + alasan,
// 409 di API termasuk restore), error isi per baris, urutan & toggle tampil langsung tersimpan
// dengan rollback saat gagal, hapus + urungkan, pratinjau dengan flag visible/empty.
// Bagian halaman publik "/" di-skip sampai halamannya dibuat (3.5). Data uji berawalan [UJI].

const HEADERS = { Origin: ORIGIN };

type Section = { id: string; type: string; title: string | null; visible: boolean; content: Record<string, unknown> | null };

async function sections(request: APIRequestContext): Promise<Section[]> {
  const response = await request.get("/api/admin/home-sections");
  return ((await response.json()) as { data: Section[] }).data;
}

async function clearSections(request: APIRequestContext) {
  for (const section of await sections(request)) {
    await request.delete(`/api/admin/home-sections/${section.id}`, { headers: HEADERS });
  }
}

async function uploadImage(request: APIRequestContext, name: string): Promise<string> {
  const buffer = await readFile(path.join(__dirname, "fixtures", "sample.png"));
  const response = await request.post("/api/admin/media", {
    headers: HEADERS,
    multipart: { files: { name, mimeType: "image/png", buffer }, folder: "uji" },
  });
  return ((await response.json()) as { data: { created: { id: string }[] } }).data.created[0].id;
}

const field = (page: Page, name: string) => page.getByRole("textbox", { name, exact: true });
const toast = (page: Page, text: string | RegExp) =>
  expect(page.locator("[data-sonner-toast]").filter({ hasText: text }).first()).toBeVisible();

async function moveUp(page: Page, gripLabel: string) {
  await page.getByRole("button", { name: `Ubah urutan ${gripLabel}`, exact: true }).focus();
  await page.keyboard.press("Space");
  await page.waitForTimeout(200);
  await page.keyboard.press("ArrowUp");
  await page.waitForTimeout(200);
  await page.keyboard.press("Space");
}

async function openAddMenu(page: Page) {
  await page.getByRole("button", { name: "Tambah section" }).first().click();
}

test.describe.configure({ mode: "serial" });

test.describe("builder beranda", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaApi(page.request);
  });

  test("tambah, error per baris, urutkan, toggle, rollback, hapus + urungkan", async ({ page }) => {
    await clearSections(page.request);
    const id = runId();
    const imageNoAlt = `[UJI]-hero-tanpa-alt-${id}.png`;
    await uploadImage(page.request, imageNoAlt);

    // HERO lewat UI, kata kunci diurutkan dengan keyboard.
    await page.goto("/admin/home");
    await expect(page.getByText("Beranda belum punya section")).toBeVisible();
    await openAddMenu(page);
    await page.getByRole("menuitem", { name: /^Hero/ }).click();
    await page.waitForURL(/\/admin\/home\/new\?type=HERO$/);
    await field(page, "Headline").fill(`[UJI] Belajar lebih terarah ${id}`);
    await page.getByRole("button", { name: "Tambah kata kunci" }).click();
    await page.getByRole("textbox", { name: "Kata kunci 1", exact: true }).fill("judul");
    await page.getByRole("button", { name: "Tambah kata kunci" }).click();
    await page.getByRole("textbox", { name: "Kata kunci 2", exact: true }).fill("jadwal");
    await moveUp(page, "Kata kunci 2");

    // Error BE content.image: gambar hero tanpa alt ditolak dan ditampilkan di field gambar.
    await page.locator("button", { hasText: "Pilih gambar" }).first().click();
    const picker = page.getByRole("dialog");
    await picker.getByRole("searchbox").fill(`hero-tanpa-alt-${id}`);
    await picker.getByRole("button", { name: `Pilih ${imageNoAlt}`, exact: true }).click();
    await picker.getByRole("button", { name: "Pakai gambar ini" }).click();
    await page.getByRole("button", { name: "Simpan", exact: true }).click();
    const altError = page.getByText("Gambar belum punya teks alt. Isi alt di media library dulu.");
    await expect(altError).toBeVisible();
    await expect(altError).toBeInViewport();
    await page.locator("button", { hasText: "Lepas" }).first().click();
    await page.getByRole("button", { name: "Simpan", exact: true }).click();
    await page.waitForURL(/\/admin\/home\/[0-9a-f-]{36}$/);
    await toast(page, "Section disimpan");
    const hero = (await sections(page.request)).find((section) => section.type === "HERO");
    expect(hero?.content?.rotatingWords).toEqual(["jadwal", "judul"]);

    // HERO tidak bisa ditambah lagi: item menu nonaktif dengan alasan (teks + tooltip).
    await page.goto("/admin/home");
    await openAddMenu(page);
    const heroItem = page.getByRole("menuitem", { name: /^Hero/ });
    await expect(heroItem).toHaveAttribute("aria-disabled", "true");
    await expect(heroItem).toContainText("Hero sudah ada. Beranda hanya boleh punya satu Hero.");
    await heroItem.hover({ force: true });
    await expect(page.getByRole("tooltip")).toContainText("Hero sudah ada");

    // STATS: error validasi baris ke-2 diarahkan ke baris yang tepat.
    await page.getByRole("menuitem", { name: /^Statistik/ }).click();
    await page.waitForURL(/type=STATS$/);
    await page.getByRole("spinbutton", { name: "Angka 1", exact: true }).fill("100");
    await page.getByRole("textbox", { name: "Akhiran" }).first().fill("+");
    await page.getByRole("textbox", { name: "Label 1", exact: true }).fill("Trainer");
    await page.getByRole("button", { name: "Tambah angka" }).click();
    await page.getByRole("spinbutton", { name: "Angka 2", exact: true }).fill("4");
    await page.getByRole("button", { name: "Simpan", exact: true }).click();
    const rowError = page.getByText("Label wajib diisi.");
    await expect(rowError).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Label 2", exact: true })).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByRole("textbox", { name: "Label 1", exact: true })).not.toHaveAttribute("aria-invalid", "true");
    await page.getByRole("textbox", { name: "Label 2", exact: true }).fill("Negara");
    await field(page, "Label internal").fill(`[UJI] Statistik ${id}`);
    await page.getByRole("button", { name: "Simpan", exact: true }).click();
    await page.waitForURL(/\/admin\/home\/[0-9a-f-]{36}$/);
    await toast(page, "Section disimpan");

    // Urutkan: Statistik naik di atas Hero (langsung tersimpan).
    await page.goto("/admin/home");
    await moveUp(page, `Statistik ([UJI] Statistik ${id})`);
    await toast(page, "Urutan section disimpan");
    expect((await sections(page.request)).map((section) => section.type)).toEqual(["STATS", "HERO"]);

    // Toggle tampil: langsung tersimpan.
    const statsSwitch = page.getByRole("switch", { name: `Tampilkan Statistik ([UJI] Statistik ${id}) di beranda` });
    await statsSwitch.click();
    await toast(page, "Section disembunyikan");
    await expect.poll(async () => (await sections(page.request)).find((s) => s.type === "STATS")?.visible).toBe(false);
    await page.reload();
    await expect(page.getByRole("switch", { name: /Tampilkan Statistik/ })).not.toBeChecked();

    // Gagal simpan: tampilan kembali seperti semula + toast.
    await page.route("**/api/admin/home-sections/*", async (route) => {
      if (route.request().method() === "PATCH") {
        await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: { code: "INTERNAL_ERROR", message: "Gagal (uji)." } }) });
      } else {
        await route.fallback();
      }
    });
    await page.getByRole("switch", { name: /Tampilkan Statistik/ }).click();
    await toast(page, "Gagal (uji).");
    await expect(page.getByRole("switch", { name: /Tampilkan Statistik/ })).not.toBeChecked();
    await page.unroute("**/api/admin/home-sections/*");

    // Hapus + Urungkan.
    await page.getByRole("button", { name: /^Hapus Hero/ }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Hapus", exact: true }).click();
    await toast(page, "dipindahkan ke Sampah");
    expect((await sections(page.request)).map((section) => section.type)).toEqual(["STATS"]);
    await page.locator("[data-sonner-toast]").getByRole("button", { name: "Urungkan" }).click();
    await toast(page, "dipulihkan");
    expect((await sections(page.request)).map((section) => section.type)).toEqual(["STATS", "HERO"]);
  });

  test("CTA satu instance: buat kedua dan pulihkan yang bentrok -> 409", async ({ page }) => {
    const create = (heading: string) =>
      page.request.post("/api/admin/home-sections", {
        headers: HEADERS,
        data: { type: "CTA", content: { heading, primaryCta: { label: "Hubungi kami", href: "/kontak" } } },
      });
    const first = await create("[UJI] CTA pertama");
    expect(first.status()).toBe(201);
    const firstId = ((await first.json()) as { data: { id: string } }).data.id;

    const duplicate = await create("[UJI] CTA kedua");
    expect(duplicate.status()).toBe(409);
    expect(((await duplicate.json()) as { error: { message: string } }).error.message).toBe(
      "Section CTA penutup sudah ada. Beranda hanya boleh punya satu CTA penutup.",
    );

    await page.request.delete(`/api/admin/home-sections/${firstId}`, { headers: HEADERS });
    expect((await create("[UJI] CTA pengganti")).status()).toBe(201);
    const restore = await page.request.post(`/api/admin/home-sections/${firstId}/restore`, { headers: HEADERS });
    expect(restore.status()).toBe(409);
    expect(((await restore.json()) as { error: { message: string } }).error.message).toContain(
      "Hapus section CTA penutup itu dulu",
    );
  });

  test("pratinjau & API publik: section tersembunyi dan kosong", async ({ page }) => {
    await page.request.post("/api/admin/home-sections", {
      headers: HEADERS,
      data: { type: "CLIENTS", title: "[UJI] Klien kosong", content: { mode: "manual", ids: ["0199b4d0-0000-7000-8000-00000000dead"] } },
    });
    const preview = ((await (await page.request.get("/api/admin/home-sections/preview")).json()) as {
      data: { sections: { type: string; visible: boolean; empty: boolean }[] };
    }).data.sections;
    expect(preview.find((section) => section.type === "STATS")).toMatchObject({ visible: false, empty: false });
    expect(preview.find((section) => section.type === "CLIENTS")).toMatchObject({ visible: true, empty: true });

    const publicHome = ((await (await page.request.get("/api/public/home")).json()) as {
      data: { sections: { type: string }[] };
    }).data.sections.map((section) => section.type);
    // STATS tersembunyi dan CLIENTS kosong tidak tampil di publik.
    expect(publicHome).not.toContain("STATS");
    expect(publicHome).not.toContain("CLIENTS");
    expect(publicHome).toContain("HERO");
  });

  test("beranda publik mengikuti urutan & sembunyi dari builder", async ({ page }) => {
    test.skip(true, "Halaman beranda publik dibuat di Fase 3.5.");
    await page.goto("/");
  });
});
