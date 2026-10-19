import { expect, type APIRequestContext, type Browser, type Page } from "@playwright/test";
import { E2E_FE_ORIGIN } from "./e2e-env";

export const ORIGIN = E2E_FE_ORIGIN;

export function adminCredentials() {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    throw new Error("ADMIN_PASSWORD wajib ada di .env root untuk test e2e.");
  }
  return { password };
}

// Login lewat API (lebih cepat dari UI). Cookie sesi tersimpan di browser context milik page.
export async function loginViaApi(request: APIRequestContext) {
  const response = await request.post("/api/auth/login", {
    data: adminCredentials(),
    headers: { Origin: ORIGIN },
  });
  expect(response.status(), await response.text()).toBe(200);
}

export async function loginViaUi(page: Page, password: string) {
  await page.goto("/admin/login");
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

// JPEG 2400x1350 dengan gradasi + noise, supaya ukuran varian WebP mendekati foto sungguhan
// (sample.png berwarna rata sehingga ukurannya tidak mewakili). Dibuat saat test, tanpa file biner.
// colors/seed: variasi supaya beberapa gambar uji terlihat berbeda (mis. slide hero).
export async function photoLikeJpeg(
  browser: Browser,
  { from = "#5b6b7a", to = "#c9b79c", seed: initialSeed = 7 }: { from?: string; to?: string; seed?: number } = {},
): Promise<{ buffer: Buffer; mimeType: string }> {
  const page = await browser.newPage({ viewport: { width: 2400, height: 1350 } });
  await page.setContent('<canvas id="c" width="2400" height="1350" style="display:block"></canvas>');
  await page.evaluate(({ from, to, initialSeed }) => {
    const canvas = document.getElementById("c") as HTMLCanvasElement;
    const context = canvas.getContext("2d");
    if (!context) return;
    const gradient = context.createLinearGradient(0, 0, 2400, 1350);
    gradient.addColorStop(0, from);
    gradient.addColorStop(1, to);
    context.fillStyle = gradient;
    context.fillRect(0, 0, 2400, 1350);
    let seed = initialSeed;
    const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 1400; i += 1) {
      context.fillStyle = `rgba(${Math.floor(random() * 255)}, ${Math.floor(random() * 255)}, ${Math.floor(random() * 255)}, 0.35)`;
      context.beginPath();
      context.arc(random() * 2400, random() * 1350, 4 + random() * 60, 0, Math.PI * 2);
      context.fill();
    }
    const noise = context.getImageData(0, 0, 2400, 1350);
    for (let i = 0; i < noise.data.length; i += 4) {
      const delta = (random() - 0.5) * 40;
      noise.data[i] += delta;
      noise.data[i + 1] += delta;
      noise.data[i + 2] += delta;
    }
    context.putImageData(noise, 0, 0);
  }, { from, to, initialSeed });
  const buffer = await page.screenshot({ type: "jpeg", quality: 85 });
  await page.close();
  return { buffer, mimeType: "image/jpeg" };
}
