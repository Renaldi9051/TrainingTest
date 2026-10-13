import { expect, test } from "@playwright/test";
import { createTraining, deleteTraining, firstCategory, loginViaApi, ORIGIN, runId, type CreatedTraining } from "./helpers";

// Dashboard admin (PRD 6.1): angka, "Perlu dibereskan" dengan tautan edit & "Lihat semua" ke daftar
// terfilter, aktivitas terakhir, dan slot Inquiry/Evaluasi tanpa angka palsu.

const HEADERS = { Origin: ORIGIN };

test.describe.configure({ mode: "serial" });
test.describe("dashboard admin", () => {
  const id = runId();
  let training: CreatedTraining;
  let scheduleId = "";

  test.beforeAll(async ({ request }) => {
    await loginViaApi(request);
    const category = await firstCategory(request);
    training = await createTraining(request, { title: `[UJI] Dashboard ${id}`, categoryIds: [category.id], status: "DRAFT" });
    const response = await request.post("/api/admin/schedules", {
      headers: HEADERS,
      data: { trainingId: training.id, startDate: "2026-01-05", endDate: "2026-01-06", method: "ONLINE", status: "OPEN" },
    });
    expect(response.status(), await response.text()).toBe(201);
    scheduleId = ((await response.json()) as { data: { id: string } }).data.id;
  });

  test.afterAll(async ({ request }) => {
    await loginViaApi(request);
    if (scheduleId) await request.delete(`/api/admin/schedules/${scheduleId}`, { headers: HEADERS });
    if (training) await deleteTraining(request, training.id);
  });

  test("angka, perlu dibereskan, aktivitas, pintasan, dan slot modul yang belum ada", async ({ page }) => {
    await loginViaApi(page.request);
    await page.goto("/admin");
    await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
    await expect(page.getByText("Pelatihan tayang")).toBeVisible();
    // Slot tanpa angka palsu.
    await expect(page.getByText("Inquiry baru")).toBeVisible();
    await expect(page.getByText("Aktif setelah modul Evaluasi dibuat.")).toBeVisible();

    const attention = page.getByRole("region", { name: "Perlu dibereskan" });
    // Jadwal lewat masih Dibuka: satu-satunya di database e2e, jadi tampil di lima teratas.
    const pastLink = attention.getByRole("link", { name: `[UJI] Dashboard ${id}` });
    await expect(pastLink).toHaveAttribute("href", "/admin/schedules?period=past&status=OPEN");
    await expect(attention.getByText("Jadwal lewat, status masih Dibuka").first()).toBeVisible();
    await expect(attention.getByText("Pelatihan tanpa sampul").first()).toBeVisible();

    const activity = page.getByRole("region", { name: "Aktivitas terakhir" });
    await expect(activity.getByRole("link", { name: "menambah jadwal" }).or(activity.getByText("menambah jadwal")).first()).toBeVisible();

    const shortcuts = page.getByRole("navigation", { name: "Pintasan" });
    await expect(shortcuts.getByRole("link", { name: "Tambah pelatihan" })).toHaveAttribute("href", "/admin/trainings/new");
  });

  test("Lihat semua: daftar pelatihan dan jadwal terbuka dengan filter yang sama", async ({ page }) => {
    await loginViaApi(page.request);
    await page.goto("/admin");
    const attention = page.getByRole("region", { name: "Perlu dibereskan" });
    await attention.getByRole("link", { name: /^Lihat semua\s*: Pelatihan tanpa sampul$/ }).click();
    await page.waitForURL(/\/admin\/trainings\?issue=no-cover$/);
    await expect(page.getByRole("combobox", { name: "Filter perlu dibereskan" })).toHaveText("Tanpa sampul");
    await page.getByRole("searchbox").fill(`Dashboard ${id}`);
    await expect(page.getByRole("link", { name: `[UJI] Dashboard ${id}` }).first()).toBeVisible();

    await page.goto("/admin");
    await page.getByRole("region", { name: "Perlu dibereskan" }).getByRole("link", { name: /^Lihat semua\s*: Jadwal lewat, status masih Dibuka$/ }).click();
    await page.waitForURL(/\/admin\/schedules\?period=past&status=OPEN$/);
    await expect(page.getByRole("combobox", { name: "Filter periode" })).toHaveText(/Sudah lewat|Lewat/);
    await expect(page.getByText(`[UJI] Dashboard ${id}`).first()).toBeVisible();
  });

  test("pintasan Tambah jadwal membuka form tambah", async ({ page }) => {
    await loginViaApi(page.request);
    await page.goto("/admin/schedules?baru=1");
    await expect(page.getByRole("dialog")).toBeVisible();
  });
});
