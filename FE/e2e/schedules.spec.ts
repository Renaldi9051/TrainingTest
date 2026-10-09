import { expect, test } from "@playwright/test";
import { createTraining, deleteTraining, firstCategory, loginViaApi, runId } from "./helpers";

test.describe("import CSV jadwal", () => {
  test("preview per baris, baris salah memblokir simpan, CSV valid tersimpan dan tampil di publik", async ({ page }) => {
    await loginViaApi(page.request);
    const category = await firstCategory(page.request);
    const id = runId();
    const training = await createTraining(page.request, {
      title: `Pelatihan Jadwal E2E ${id}`,
      categoryIds: [category.id],
      status: "PUBLISHED",
      showPrice: true,
      priceText: "Rp3.500.000",
    });
    const city = `Kota${id}`;
    const header = "training_slug,start_date,end_date,city,venue,method,price,status";

    try {
      await page.goto("/admin/schedules/import");
      await expect(page.getByRole("link", { name: "Unduh template" })).toHaveAttribute(
        "href",
        "/api/admin/schedules/import-template",
      );

      // 1. Ada baris salah: preview menandai baris itu dan tombol simpan nonaktif.
      const invalid = [header, `${training.slug},2027-01-10,2027-01-11,${city},,offline,3500000,DIBUKA`, `slug-tidak-ada-${id},2027-01-10,2027-01-09,,,teleport,,`].join("\n");
      await page.locator('input[type="file"]').setInputFiles({ name: "jadwal.csv", mimeType: "text/csv", buffer: Buffer.from(invalid) });
      await expect(page.getByText("1 bermasalah")).toBeVisible();
      await expect(page.getByText(`Pelatihan dengan slug "slug-tidak-ada-${id}" tidak ditemukan.`)).toBeVisible();
      await expect(page.getByRole("button", { name: /Simpan 1 jadwal/ })).toBeDisabled();

      // 2. CSV valid (titik koma ala Excel): simpan semua.
      const valid = [
        header.replaceAll(",", ";"),
        `${training.slug};2027-01-10;2027-01-11;${city};Ruang A;offline;3.500.000;DIBUKA`,
        `${training.slug};2027-02-07;2027-02-07;;Zoom;online;;PENUH`,
      ].join("\n");
      await page.locator('input[type="file"]').setInputFiles({ name: "jadwal.csv", mimeType: "text/csv", buffer: Buffer.from(valid) });
      await expect(page.getByText("0 bermasalah")).toBeVisible();
      await page.getByRole("button", { name: "Simpan 2 jadwal" }).click();
      await expect(page).toHaveURL(/\/admin\/schedules$/);
      await expect(page.getByText("2 jadwal berhasil diimport.")).toBeVisible();

      // 3. Tampil di /jadwal publik (filter kota) dan di detail pelatihan.
      await expect
        .poll(async () => (await (await page.request.get(`/jadwal?kota=${city}`)).text()).includes(training.title), {
          timeout: 5_000,
        })
        .toBe(true);
      await page.goto(`/pelatihan/${training.slug}`);
      const table = page.getByRole("table", { name: `Jadwal ${training.title}` });
      await expect(table.getByText("Rp3.500.000")).toBeVisible();
      await expect(table.getByText("PENUH")).toBeVisible();
    } finally {
      await deleteTraining(page.request, training.id);
    }
  });
});
