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

const MUTATION_HEADERS = { Origin: ORIGIN };

type ApiBody<T> = { data: T };

export async function firstCategory(request: APIRequestContext): Promise<{ id: string; slug: string; name: string }> {
  const response = await request.get("/api/admin/categories/options");
  expect(response.status(), await response.text()).toBe(200);
  const { data } = (await response.json()) as ApiBody<{ id: string; slug: string; name: string }[]>;
  if (!data[0]) throw new Error("Butuh minimal satu kategori (jalankan seed).");
  return data[0];
}

export const DEFAULT_OUTCOMES = [
  "Memahami konsep dasar materi",
  "Menerapkan langkah kerja utama",
  "Mengevaluasi hasil penerapan",
  "Menyusun rencana tindak lanjut",
];

export type CreatedTraining = { id: string; slug: string; title: string };

export async function createTraining(
  request: APIRequestContext,
  body: Record<string, unknown>,
): Promise<CreatedTraining> {
  // Status Tayang wajib 4-8 hasil belajar; isi otomatis kalau test tidak menentukan.
  const payload =
    body.status === "PUBLISHED" && !("outcomes" in body) ? { ...body, outcomes: DEFAULT_OUTCOMES } : body;
  const response = await request.post("/api/admin/trainings", { data: payload, headers: MUTATION_HEADERS });
  expect(response.status(), await response.text()).toBe(201);
  const { data } = (await response.json()) as ApiBody<CreatedTraining>;
  return data;
}

export async function deleteTraining(request: APIRequestContext, id: string) {
  await request.delete(`/api/admin/trainings/${id}`, { headers: MUTATION_HEADERS });
}

// Penanda unik per run supaya test bisa diulang tanpa bentrok slug/judul.
export function runId(): string {
  return `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
}
