import { readFile } from "node:fs/promises";
import path from "node:path";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import {
  createTraining,
  deleteTraining,
  firstCategory,
  loginViaApi,
  ORIGIN,
  runId,
  type CreatedTraining,
} from "./helpers";

const created: CreatedTraining[] = [];

test.afterEach(async ({ page }) => {
  for (const training of created.splice(0)) await deleteTraining(page.request, training.id);
});

async function uploadImage(request: APIRequestContext, name: string, alt: string): Promise<string> {
  const buffer = await readFile(path.join(__dirname, "fixtures", "sample.png"));
  const headers = { Origin: ORIGIN };
  const response = await request.post("/api/admin/media", {
    headers,
    multipart: { files: { name, mimeType: "image/png", buffer }, folder: "uji" },
  });
  expect(response.status(), await response.text()).toBe(201);
  const id = ((await response.json()) as { data: { created: { id: string }[] } }).data.created[0].id;
  expect((await request.patch(`/api/admin/media/${id}`, { headers, data: { alt } })).status()).toBe(200);
  return id;
}

// Pilih media lewat dialog picker (tombol dicari lewat teksnya karena nama aksesibelnya = label).
async function pickMedia(page: Page, buttonText: string, fileName: string) {
  await page.locator("button", { hasText: buttonText }).first().click();
  const dialog = page.getByRole("dialog").filter({ has: page.getByRole("button", { name: /^Pakai / }) });
  await dialog.getByRole("searchbox").fill(fileName.replace(/\.png$/, ""));
  await dialog.getByRole("button", { name: `Pilih ${fileName}`, exact: true }).click();
  await dialog.getByRole("button", { name: /^Pakai / }).click();
  await expect(page.getByRole("button", { name: /^Pakai / })).toHaveCount(0);
}

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
    const toc = page.getByRole("navigation", { name: "Isi pelatihan", exact: true });
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

  test("galeri: diisi dan diurutkan di form admin, tampil di detail terpisah dari sampul", async ({ page }) => {
    await loginViaApi(page.request);
    const category = await firstCategory(page.request);
    const id = runId();
    const files = [1, 2, 3].map((n) => `[UJI]-galeri-pelatihan-${n}-${id}.png`);
    const mediaIds: string[] = [];
    for (const [index, file] of files.entries()) {
      mediaIds.push(await uploadImage(page.request, file, `[UJI] kegiatan ${index + 1} ${id}`));
    }
    const training = await createTraining(page.request, {
      title: `Galeri Pelatihan ${id}`,
      categoryIds: [category.id],
      status: "PUBLISHED",
      modules: [{ title: "Modul galeri", points: ["Poin"], durationMinutes: null }],
    });
    created.push(training);

    // Tanpa galeri: section dan tab Galeri tidak ada.
    await page.goto(`/pelatihan/${training.slug}`);
    await expect(page.locator("#galeri")).toHaveCount(0);

    await page.goto(`/admin/trainings/${training.id}`);
    for (const file of files) await pickMedia(page, "Tambah gambar", file);
    // Urutan akhir: 3, 1 (gambar 3 naik dua kali, gambar 2 dilepas).
    for (let step = 0; step < 2; step += 1) {
      await page.getByRole("button", { name: `Ubah urutan gambar ${3 - step}`, exact: true }).focus();
      await page.keyboard.press("Space");
      await page.waitForTimeout(200);
      await page.keyboard.press("ArrowUp");
      await page.waitForTimeout(200);
      await page.keyboard.press("Space");
    }
    await page.getByRole("button", { name: "Lepas gambar 3" }).click();
    await page.getByRole("button", { name: "Simpan", exact: true }).click();
    await expect
      .poll(async () => {
        const response = await page.request.get(`/api/admin/trainings/${training.id}`);
        return ((await response.json()) as { data: { imageIds: string[] } }).data.imageIds;
      })
      .toEqual([mediaIds[2], mediaIds[0]]);

    await page.goto(`/pelatihan/${training.slug}`);
    const toc = page.getByRole("navigation", { name: "Isi pelatihan", exact: true });
    await expect(toc.getByRole("link", { name: "Galeri" })).toBeVisible();
    const gallery = page.locator("#galeri");
    await expect(gallery.getByRole("heading", { level: 2 })).toContainText("Galeri");
    await expect(gallery.locator("img")).toHaveCount(2);
    await expect(gallery.locator("img").nth(0)).toHaveAttribute("alt", `[UJI] kegiatan 3 ${id}`);
    await expect(gallery.locator("img").nth(1)).toHaveAttribute("alt", `[UJI] kegiatan 1 ${id}`);
    // Sampul tidak diambil dari galeri.
    await expect(page.locator('[data-cover-source="training"]')).toHaveCount(0);
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
    const confirm = page.getByRole("alertdialog");
    await expect(confirm.getByRole("heading", { name: "Tayangkan 2 pelatihan?" })).toBeVisible();
    await expect(confirm.getByRole("list", { name: "Pelatihan terpilih" }).getByRole("listitem")).toHaveCount(2);
    await expect(confirm).toContainText(complete.title);
    await expect(confirm).toContainText(incomplete.title);
    await expect(confirm).not.toContainText("lainnya");
    await confirm.getByRole("button", { name: "Tayangkan" }).click();

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

  test("dialog konfirmasi bulk menampilkan jumlah dan 3 judul pertama untuk setiap aksi", async ({ page }) => {
    await loginViaApi(page.request);
    const category = await firstCategory(page.request);
    const id = runId();
    for (let index = 1; index <= 4; index += 1) {
      const title = `Bulk Ringkas ${index} ${id}`;
      created.push(await createTraining(page.request, { title, categoryIds: [category.id], status: "DRAFT" }));
    }

    await page.goto("/admin/trainings");
    await page.getByPlaceholder("Cari judul atau slug").fill(id);
    await expect(page.getByRole("row")).toHaveCount(5);
    await page.getByRole("checkbox", { name: "Pilih semua di halaman ini" }).click();

    const confirm = page.getByRole("alertdialog");
    const actions = [
      { button: "Jadikan draf", heading: "Jadikan 4 pelatihan sebagai draf?" },
      { button: "Pindah kategori...", heading: "Pindah kategori 4 pelatihan?" },
      { button: "Hapus", heading: "Hapus 4 pelatihan?" },
      { button: "Tayangkan", heading: "Tayangkan 4 pelatihan?" },
    ];
    for (const action of actions) {
      await page.getByRole("region", { name: "Aksi massal" }).getByRole("button", { name: action.button }).click();
      await expect(confirm.getByRole("heading", { name: action.heading })).toBeVisible();
      await expect(confirm.getByRole("list", { name: "Pelatihan terpilih" }).getByRole("listitem")).toHaveCount(3);
      await expect(confirm).toContainText("dan 1 lainnya");
      await confirm.getByRole("button", { name: "Batal" }).click();
      await expect(confirm).toBeHidden();
    }
  });
});
