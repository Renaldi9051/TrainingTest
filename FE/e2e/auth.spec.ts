import { expect, test } from "@playwright/test";
import { adminCredentials, loginViaApi, loginViaUi } from "./helpers";

test.describe("auth admin", () => {
  test("login sukses masuk ke dashboard", async ({ page }) => {
    await loginViaUi(page, adminCredentials().password);
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
  });

  test("login gagal menampilkan pesan umum", async ({ page }) => {
    // Rate limit dihitung per IP (5x gagal). Satu kegagalan di sini tidak mengunci test lain, dan
    // login sukses berikutnya mereset hitungannya.
    await loginViaUi(page, "kata-sandi-salah");
    await expect(page.getByRole("alert").filter({ hasText: "Kata sandi salah." })).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test("/admin tanpa sesi diarahkan ke login", async ({ page }) => {
    await page.goto("/admin/media");
    await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin%2Fmedia$/);
    await expect(page.getByRole("heading", { level: 1, name: "Masuk" })).toBeVisible();
  });

  test("logout mengakhiri sesi", async ({ page }) => {
    await loginViaApi(page.request);
    await page.goto("/admin");
    await page.getByRole("button", { name: "Menu akun" }).click();
    await page.getByRole("menuitem", { name: "Keluar" }).click();
    await expect(page).toHaveURL(/\/admin\/login$/);

    // Sesi di BE sudah dihapus, bukan hanya cookie.
    const me = await page.request.get("/api/auth/me");
    expect(me.status()).toBe(401);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login/);
  });
});
