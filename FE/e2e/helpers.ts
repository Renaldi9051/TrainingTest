import { expect, type APIRequestContext, type Page } from "@playwright/test";

export const ORIGIN = "http://localhost:3000";

export function adminCredentials() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error("ADMIN_EMAIL dan ADMIN_PASSWORD wajib ada di .env root untuk test e2e.");
  }
  return { email, password };
}

// Login lewat API (lebih cepat dari UI). Cookie sesi tersimpan di browser context milik page.
export async function loginViaApi(request: APIRequestContext) {
  const response = await request.post("/api/auth/login", {
    data: adminCredentials(),
    headers: { Origin: ORIGIN },
  });
  expect(response.status(), await response.text()).toBe(200);
}

export async function loginViaUi(page: Page, email: string, password: string) {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Kata sandi").fill(password);
  await page.getByRole("button", { name: "Masuk" }).click();
}
