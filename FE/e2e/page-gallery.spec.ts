import { mkdirSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { loginViaApi, ORIGIN, runId } from "./helpers";

// Blok halaman "Galeri foto" (GALLERY): editor menolak galeri tanpa foto, publik menampilkan grid
// tombol foto, lightbox bisa dipakai penuh dengan keyboard (panah ganti foto, Esc tutup, fokus kembali
// ke foto asal). Halaman uji berawalan [UJI] dan dipindah ke Sampah di akhir.
// Screenshot 360/768/1280 ke SCREENS_OUT (opsional): SCREENS_OUT=<folder> npx playwright test e2e/page-gallery.spec.ts

const HEADERS = { Origin: ORIGIN };
const id = runId();
const title = `[UJI] Galeri ${id}`;
const slug = `uji-galeri-${id}`;
const HEADING = "Dokumentasi kegiatan";
let pageId = "";
let photoCount = 0;

test.describe.configure({ mode: "serial" });

test.describe("blok galeri foto", () => {
  test.afterAll(async ({ browser }) => {
    const context = await browser.newContext({ baseURL: ORIGIN });
    await loginViaApi(context.request);
    if (pageId) await context.request.delete(`/api/admin/pages/${pageId}`, { headers: HEADERS });
    await context.close();
  });

  test("editor: galeri tanpa foto ditolak", async ({ page }) => {
    await loginViaApi(page.request);
    await page.goto("/admin/pages/new");
    await page.getByRole("textbox", { name: "Judul", exact: true }).fill(`${title} kosong`);
    await page.getByRole("button", { name: "Tambah blok" }).click();
    await page.getByRole("menuitem", { name: /^Galeri foto/ }).click();
    await page.getByRole("button", { name: "Simpan", exact: true }).click();
    await expect(page.getByText("Pilih minimal satu foto.")).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/pages\/new$/);
  });

  test("publik: grid foto dan lightbox dengan keyboard", async ({ page }) => {
    await loginViaApi(page.request);
    // Foto ber-alt dari media library (alt wajib untuk blok galeri).
    const list = await page.request.get("/api/admin/media?type=image&pageSize=100");
    const media = ((await list.json()) as { data: { id: string; alt: string | null }[] }).data;
    const photos = media.filter((item) => item.alt?.trim()).slice(0, 5);
    test.skip(photos.length < 2, "Butuh minimal 2 gambar ber-alt di media library.");
    photoCount = photos.length;

    const created = await page.request.post("/api/admin/pages", {
      headers: HEADERS,
      data: {
        title,
        slug,
        status: "PUBLISHED",
        blocks: [
          {
            id: randomUUID(),
            type: "GALLERY",
            eyebrow: "Galeri",
            heading: HEADING,
            intro: "Foto kegiatan pelatihan.",
            images: photos.map((photo) => ({ mediaId: photo.id })),
          },
        ],
      },
    });
    expect(created.status(), await created.text()).toBe(201);
    pageId = ((await created.json()) as { data: { id: string } }).data.id;

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/${slug}`);
    await expect(page.getByRole("heading", { name: HEADING })).toBeVisible();
    const buttons = page.getByRole("button", { name: /^Buka foto \d+ dari \d+$/ });
    await expect(buttons).toHaveCount(photoCount);

    // Buka dari keyboard, ganti foto dengan panah, Esc menutup dan fokus kembali ke tombol asal.
    const first = page.getByRole("button", { name: `Buka foto 1 dari ${photoCount}` });
    await first.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: HEADING });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(`Foto 1 / ${photoCount}`)).toBeVisible();
    await page.keyboard.press("ArrowRight");
    await expect(dialog.getByText(`Foto 2 / ${photoCount}`)).toBeVisible();
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    await expect(dialog.getByText(`Foto ${photoCount} / ${photoCount}`)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(first).toBeFocused();

    // Dibuka lagi dari foto 1 setelah terakhir di foto terakhir: gambar di lightbox foto 1, bukan sisa
    // foto sebelumnya.
    await first.click();
    await expect(dialog.getByText(`Foto 1 / ${photoCount}`)).toBeVisible();
    await expect(dialog.getByRole("img")).toHaveAttribute("alt", photos[0]?.alt ?? "");
    await page.keyboard.press("Escape");

    const out = process.env.SCREENS_OUT;
    if (out) {
      const dir = path.resolve(out);
      mkdirSync(dir, { recursive: true });
      for (const width of [360, 768, 1280]) {
        await page.setViewportSize({ width, height: 900 });
        await page.getByRole("heading", { name: HEADING }).scrollIntoViewIfNeeded();
        await page.screenshot({ path: path.join(dir, `galeri-${width}.png`), fullPage: true });
      }
      await page.setViewportSize({ width: 1280, height: 900 });
      await first.click();
      await page.screenshot({ path: path.join(dir, "galeri-lightbox-1280.png") });
    }
  });
});
