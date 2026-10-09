import { expect, test } from "@playwright/test";
import { createTraining, deleteTraining, firstCategory, loginViaApi, runId, type CreatedTraining } from "./helpers";

const created: CreatedTraining[] = [];

test.afterEach(async ({ page }) => {
  for (const training of created.splice(0)) await deleteTraining(page.request, training.id);
});

test.describe("detail pelatihan terstruktur", () => {
  test("daftar isi hanya dari bagian berisi, materi accordion bisa dengan keyboard dan Buka semua", async ({ page }) => {
    await loginViaApi(page.request);
    const category = await firstCategory(page.request);
    const training = await createTraining(page.request, {
      title: `Detail Terstruktur ${runId()}`,
      summary: "Ringkasan satu kalimat untuk uji struktur halaman.",
      categoryIds: [category.id],
      status: "PUBLISHED",
      modules: [
        { title: "Modul pertama", points: ["Poin A1", "Poin A2"], durationMinutes: 90 },
        { title: "Modul kedua", points: ["Poin B1"], durationMinutes: null },
        { title: "Modul ketiga", points: ["Poin C1"], durationMinutes: 60 },
      ],
      audience: [{ role: "Supervisor", note: "yang memimpin tim kecil" }],
      faq: [{ q: "Pertanyaan khusus uji?", a: "Jawaban khusus uji." }],
      showPrice: false,
    });
    created.push(training);

    await page.goto(`/pelatihan/${training.slug}`);
    await expect(page.getByRole("heading", { level: 1, name: training.title })).toBeVisible();

    // Strip fakta: tanpa jadwal = "Jadwal menyesuaikan", showPrice mati = "Hubungi marketing".
    const facts = page.getByRole("definition");
    await expect(facts.filter({ hasText: "Jadwal menyesuaikan" })).toHaveCount(1);
    await expect(facts.filter({ hasText: "Hubungi marketing" })).toHaveCount(1);

    // Daftar isi (desktop): tanpa Deskripsi (kosong); #jadwal selalu ada.
    const toc = page.getByRole("navigation", { name: "Daftar isi", exact: true });
    await expect(toc.getByRole("link")).toHaveText([
      "Hasil belajar",
      "Materi",
      "Peserta",
      "Jadwal & investasi",
      "Fasilitas",
      "FAQ",
    ]);
    await expect(page.locator("#deskripsi")).toHaveCount(0);
    await expect(page.locator("#jadwal")).toContainText("Jadwal menyesuaikan");

    // Accordion materi: tertutup di awal, bisa dibuka dengan keyboard.
    const materi = page.locator("#materi");
    const firstModule = materi.locator("details").first();
    await expect(firstModule).not.toHaveAttribute("open", "");
    await materi.locator("summary").first().focus();
    await page.keyboard.press("Enter");
    await expect(firstModule).toHaveAttribute("open", "");
    await expect(materi.getByText("Poin A1")).toBeVisible();

    // Buka semua -> semua modul terbuka; tombol berubah jadi Tutup semua.
    await materi.getByRole("button", { name: "Buka semua materi" }).click();
    await expect(materi.locator("details[open]")).toHaveCount(3);
    await materi.getByRole("button", { name: "Tutup semua materi" }).click();
    await expect(materi.locator("details[open]")).toHaveCount(0);

    // FAQ pelatihan tampil sebelum FAQ umum.
    await expect(page.locator("#faq summary").first()).toContainText("Pertanyaan khusus uji?");
  });

  test("tayang massal melewati pelatihan yang belum lengkap dan melaporkan judulnya", async ({ page }) => {
    await loginViaApi(page.request);
    const category = await firstCategory(page.request);
    const id = runId();
    const complete = await createTraining(page.request, {
      title: `Bulk Lengkap ${id}`,
      categoryIds: [category.id],
      status: "DRAFT",
      outcomes: ["Satu", "Dua", "Tiga", "Empat"],
    });
    const incomplete = await createTraining(page.request, {
      title: `Bulk Kurang ${id}`,
      categoryIds: [category.id],
      status: "DRAFT",
      outcomes: ["Satu"],
    });
    created.push(complete, incomplete);

    await page.goto("/admin/trainings");
    await page.getByPlaceholder("Cari judul atau slug").fill(id);
    await expect(page.getByRole("link", { name: complete.title, exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: incomplete.title, exact: true })).toBeVisible();
    // Tunggu hasil pencarian benar-benar tampil (2 baris) sebelum memilih semua.
    await expect(page.getByRole("row")).toHaveCount(3);
    await page.getByRole("checkbox", { name: "Pilih semua di halaman ini" }).click();
    await page.getByRole("button", { name: "Tayangkan" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Tayangkan" }).click();

    const report = page.getByRole("dialog");
    await expect(report.getByRole("heading", { name: "1 dipublikasikan, 1 dilewati" })).toBeVisible();
    await expect(report.getByRole("link", { name: incomplete.title })).toBeVisible();
    await expect(report).toContainText("hasil belajar");

    const states = await Promise.all(
      [complete, incomplete].map(async (training) => {
        const response = await page.request.get(`/api/admin/trainings/${training.id}`);
        return ((await response.json()) as { data: { publicState: string } }).data.publicState;
      }),
    );
    expect(states).toEqual(["PUBLISHED", "DRAFT"]);
  });
});
