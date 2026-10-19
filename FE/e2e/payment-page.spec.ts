import { mkdirSync } from "node:fs";
import path from "node:path";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { loginViaApi, ORIGIN, runId } from "./helpers";

// Halaman pembayaran (blok PAYMENT_ACCOUNTS): admin menyusun rekening di editor halaman (nomor tidak
// valid ditolak, tombol konfirmasi opsional), menu "Pembayaran" di header, publik menampilkan rekening,
// tombol Salin menyalin angka saja, tanpa JS nomor tetap tampil tanpa tombol mati. Data uji berawalan
// [UJI]; menu & halaman dipindah ke Sampah di akhir.
// Screenshot 360/768/1280 ke SCREENS_OUT (opsional): SCREENS_OUT=<folder> npx playwright test e2e/payment-page.spec.ts

const HEADERS = { Origin: ORIGIN };

const id = runId();
const title = `[UJI] Pembayaran ${id}`;
const slug = `uji-pembayaran-${id}`;
const BANK = `[UJI] Bank Contoh ${id}`;
let pageId = "";
let navId = "";

const field = (page: Page, name: string) => page.getByRole("textbox", { name, exact: true });

async function addNav(request: APIRequestContext) {
  const response = await request.post("/api/admin/nav", {
    headers: HEADERS,
    data: { location: "HEADER", label: "Pembayaran", href: `/${slug}` },
  });
  expect(response.status(), await response.text()).toBe(201);
  navId = ((await response.json()) as { data: { id: string } }).data.id;
}

test.describe.configure({ mode: "serial" });

test.describe("halaman pembayaran", () => {
  test.afterAll(async ({ browser }) => {
    const context = await browser.newContext({ baseURL: ORIGIN });
    await loginViaApi(context.request);
    if (navId) await context.request.delete(`/api/admin/nav/${navId}`, { headers: HEADERS });
    if (pageId) await context.request.delete(`/api/admin/pages/${pageId}`, { headers: HEADERS });
    await context.close();
  });

  test("admin menyusun rekening di editor: nomor tidak valid ditolak, tombol konfirmasi opsional", async ({ page }) => {
    await loginViaApi(page.request);
    await page.goto("/admin/pages/new");
    await field(page, "Judul").fill(title);

    await page.getByRole("button", { name: "Tambah blok" }).click();
    await page.getByRole("menuitem", { name: /^Rekening pembayaran/ }).click();
    await field(page, "Judul blok").fill("Rekening pembayaran");
    await field(page, "Nama bank").fill(BANK);
    await field(page, "Nomor rekening").fill("12ab 34");
    await field(page, "Atas nama").fill("[UJI] PT Contoh");
    await page.getByRole("checkbox", { name: "Tombol konfirmasi pembayaran" }).check();
    await field(page, "Label tombol").fill("Konfirmasi pembayaran");
    await field(page, "Tautan").fill("/kontak");

    await page.getByRole("button", { name: "Simpan", exact: true }).click();
    await expect(page.getByText("Nomor rekening hanya boleh berisi angka, spasi, atau strip.")).toBeVisible();

    await field(page, "Nomor rekening").fill("123 456-7890");
    await page.getByRole("button", { name: "Tambah rekening" }).click();
    await page.getByRole("textbox", { name: "Nama bank", exact: true }).last().fill("[UJI] Bank Kedua");
    await page.getByRole("textbox", { name: "Nomor rekening", exact: true }).last().fill("0987654321");
    await page.getByRole("textbox", { name: "Atas nama", exact: true }).last().fill("[UJI] PT Contoh");
    await page.getByRole("textbox", { name: "Catatan", exact: true }).last().fill("Khusus pelatihan in-house");

    await page.getByText("Tayang", { exact: true }).click();
    await page.getByRole("button", { name: "Simpan", exact: true }).click();
    await page.waitForURL(/\/admin\/pages\/[0-9a-f-]{36}$/);
    pageId = page.url().split("/").pop() ?? "";

    const detail = await page.request.get(`/api/admin/pages/${pageId}`);
    const blocks = ((await detail.json()) as { data: { slug: string; blocks: Record<string, unknown>[] } }).data;
    expect(blocks.slug).toBe(slug);
    expect(blocks.blocks[0]).toMatchObject({
      type: "PAYMENT_ACCOUNTS",
      accounts: [
        { bank: BANK, number: "123 456-7890", holder: "[UJI] PT Contoh", note: "", logo: null },
        { bank: "[UJI] Bank Kedua", number: "0987654321", note: "Khusus pelatihan in-house" },
      ],
      confirm: { label: "Konfirmasi pembayaran", href: "/kontak" },
    });
    await addNav(page.request);
  });

  test("publik: menu Pembayaran, rekening tampil, Salin menyalin angka saja", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");
    await page.getByRole("navigation", { name: "Menu utama", exact: true }).getByRole("link", { name: "Pembayaran" }).click();
    await page.waitForURL(`**/${slug}`);

    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await expect(page.getByRole("heading", { level: 3, name: BANK })).toBeVisible();
    await expect(page.getByText("123 456-7890", { exact: true })).toBeVisible();
    await expect(page.getByText("Khusus pelatihan in-house")).toBeVisible();

    const copy = page.getByRole("button", { name: `Salin nomor rekening ${BANK}` });
    await copy.click();
    await expect(copy).toHaveText("Tersalin");
    await expect(page.getByRole("status").filter({ hasText: "tersalin" })).toHaveCount(1);
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("1234567890");
    // Kembali ke "Salin" setelah 2 detik.
    await expect(copy).toHaveText("Salin", { timeout: 4000 });

    // Keyboard: tombol bisa dicapai & dipakai dengan Enter.
    const second = page.getByRole("button", { name: "Salin nomor rekening [UJI] Bank Kedua" });
    await second.focus();
    await page.keyboard.press("Enter");
    await expect(second).toHaveText("Tersalin");
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("0987654321");

    await page.getByRole("link", { name: /Konfirmasi pembayaran/ }).click();
    await page.waitForURL("**/kontak");
  });

  test("tanpa JS: nomor tetap tampil, tanpa tombol Salin yang mati", async ({ browser }) => {
    const context = await browser.newContext({ baseURL: ORIGIN, javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto(`/${slug}`);
    await expect(page.getByText("123 456-7890", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Salin nomor rekening/ })).toHaveCount(0);
    await context.close();
  });

  test("screenshot 360/768/1280 @screens", async ({ page }) => {
    const out = process.env.SCREENS_OUT;
    test.skip(!out, "SCREENS_OUT tidak diisi");
    mkdirSync(out as string, { recursive: true });
    const problems: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error" || message.type() === "warning") problems.push(`${message.type()}: ${message.text()}`);
    });
    page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
    for (const width of [360, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/${slug}`);
      await page.emulateMedia({ reducedMotion: "reduce" });
      await expect(page.getByRole("button", { name: /^Salin nomor rekening/ }).first()).toBeVisible();
      await page.screenshot({ path: path.join(out as string, `pembayaran-${width}.png`), fullPage: true });
    }
    // Tidak ada error/peringatan console (mis. hydration mismatch dari tombol Salin).
    expect(problems).toEqual([]);
  });
});
