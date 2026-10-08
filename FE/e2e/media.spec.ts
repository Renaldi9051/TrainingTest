import { readFile } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { loginViaApi, ORIGIN } from "./helpers";

test("upload 1 gambar lalu muncul di grid media", async ({ page }) => {
  await loginViaApi(page.request);
  await page.goto("/admin/media");
  await expect(page.getByRole("heading", { level: 1, name: "Media library" })).toBeVisible();

  const name = `e2e-${Date.now()}.png`;
  const buffer = await readFile(path.join(__dirname, "fixtures", "sample.png"));
  const uploadResponse = page.waitForResponse(
    (response) => response.url().endsWith("/api/admin/media") && response.request().method() === "POST",
  );
  await page.getByTestId("media-file-input").setInputFiles({ name, mimeType: "image/png", buffer });

  const response = await uploadResponse;
  expect(response.status()).toBe(201);
  const body = (await response.json()) as { data: { created: { id: string }[] } };
  const mediaId = body.data.created[0]?.id;
  expect(mediaId).toBeTruthy();

  try {
    const tile = page.getByTestId("media-grid").getByRole("button", { name: `Lihat detail ${name}` });
    await expect(tile).toBeVisible();
    await expect(tile.getByText("Tanpa alt")).toBeVisible();
    // Thumbnail memakai varian WebP buatan BE lewat image loader.
    await expect(tile.locator("img")).toHaveAttribute("src", /\/uploads\/\d{4}\/\d{2}\/.+-(320|768|1600)\.webp$/);
  } finally {
    // Bersihkan data test (soft delete).
    await page.request.delete(`/api/admin/media/${mediaId}`, { headers: { Origin: ORIGIN } });
  }
});
