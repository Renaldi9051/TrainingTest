import { expect, test, type APIRequestContext } from "@playwright/test";
import { loginViaApi, ORIGIN, runId } from "./helpers";

// Artikel: tulis lewat admin -> tayang di /artikel & /artikel/[slug]; jadwalkan -> muncul di
// kalender admin tapi belum tampil di situs; tayang tanpa isi ditolak. Data uji berawalan [UJI].

const HEADERS = { Origin: ORIGIN };

async function createCategory(request: APIRequestContext, name: string): Promise<{ id: string; slug: string }> {
  const response = await request.post("/api/admin/article-categories", { headers: HEADERS, data: { name } });
  expect(response.status(), await response.text()).toBe(201);
  return ((await response.json()) as { data: { id: string; slug: string } }).data;
}

const body = (text: string) => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] });

// "2026-11" di WIB untuk tanggal tertentu.
const wibMonth = (date: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit" }).format(date);

test.describe("artikel", () => {
  test("tulis artikel di admin lalu tayang di /artikel dan halaman detail", async ({ page }) => {
    await loginViaApi(page.request);
    const id = runId();
    const category = await createCategory(page.request, `[UJI] Teknologi ${id}`);
    const title = `[UJI] Drone mapping ${id}`;

    await page.goto("/admin/articles/new");
    await page.getByRole("textbox", { name: "Judul artikel" }).fill(title);
    await page.getByRole("textbox", { name: "Penulis / tim" }).fill("Tim Media");
    await page.getByRole("combobox", { name: "Kategori" }).click();
    await page.getByRole("option", { name: `[UJI] Teknologi ${id}` }).click();
    await page.getByRole("textbox", { name: "Ringkasan singkat" }).fill("Ringkasan artikel uji.");

    // Tayang tanpa isi: ditolak di form.
    await page.getByRole("radio", { name: /Tayang sekarang/ }).check();
    await page.getByRole("button", { name: "Tayangkan", exact: true }).click();
    await expect(page.getByText("Isi artikel wajib diisi sebelum ditayangkan.")).toBeVisible();

    await page.getByRole("textbox", { name: "Isi artikel" }).click();
    await page.keyboard.type("Paragraf isi artikel uji untuk halaman publik.");
    await page.getByRole("button", { name: "Tayangkan", exact: true }).click();
    await expect(page.getByText("Artikel tayang. Situs diperbarui dalam beberapa detik.")).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/articles\/[0-9a-f-]{36}$/);

    // Daftar admin: tab Tayang berisi artikel ini.
    await page.goto("/admin/articles");
    await page.getByRole("button", { name: /^Tayang( \d+)?$/ }).click();
    await page.getByRole("searchbox", { name: "Cari judul atau slug" }).fill(id);
    await expect(page.getByRole("link", { name: title, exact: true })).toBeVisible();

    // Publik: kartu di /artikel (filter kategori), lalu detail.
    await expect(async () => {
      await page.goto(`/artikel?kategori=${category.slug}`);
      await expect(page.getByRole("link", { name: title, exact: true })).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 20_000 });
    await page.getByRole("link", { name: title, exact: true }).click();
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await expect(page.getByText("Paragraf isi artikel uji untuk halaman publik.")).toBeVisible();
    await expect(page.getByText("Tim Media")).toBeVisible();
  });

  test("artikel terjadwal tampil di kalender admin dan belum tampil di situs", async ({ page }) => {
    await loginViaApi(page.request);
    const id = runId();
    const category = await createCategory(page.request, `[UJI] Berita ${id}`);
    const title = `[UJI] Terjadwal ${id}`;
    const at = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const created = await page.request.post("/api/admin/articles", {
      headers: HEADERS,
      data: {
        title,
        authorName: "Tim Media",
        categoryId: category.id,
        body: body("Isi terjadwal."),
        status: "PUBLISHED",
        publishedAt: at.toISOString(),
      },
    });
    expect(created.status(), await created.text()).toBe(201);
    const article = ((await created.json()) as { data: { slug: string; publicState: string } }).data;
    expect(article.publicState).toBe("SCHEDULED");

    const publicResponse = await page.request.get(`/artikel/${article.slug}`);
    expect(publicResponse.status()).toBe(404);

    await page.goto("/admin/articles?tab=kalender");
    // Pindah ke bulan jadwal kalau berbeda dengan bulan ini (3 hari ke depan bisa lintas bulan).
    if (wibMonth(at) !== wibMonth(new Date())) await page.getByRole("button", { name: "Bulan berikutnya" }).click();
    const agenda = page.getByRole("region", { name: "Agenda bulan ini" });
    await expect(agenda.getByRole("link", { name: title, exact: true })).toBeVisible();
  });

  test("section beranda Artikel terbaru menampilkan artikel tayang terbaru", async ({ page }) => {
    await loginViaApi(page.request);
    const id = runId();
    const category = await createCategory(page.request, `[UJI] Kabar ${id}`);
    const title = `[UJI] Kabar terbaru ${id}`;
    const created = await page.request.post("/api/admin/articles", {
      headers: HEADERS,
      data: { title, authorName: "Tim Media", categoryId: category.id, body: body("Isi."), status: "PUBLISHED" },
    });
    expect(created.status(), await created.text()).toBe(201);
    const heading = `[UJI] Berita & artikel ${id}`;
    const section = await page.request.post("/api/admin/home-sections", {
      headers: HEADERS,
      data: {
        type: "LATEST_ARTICLES",
        content: { heading, limit: 3, cta: { label: "Lihat semua artikel", href: "/artikel" } },
      },
    });
    expect(section.status(), await section.text()).toBe(201);
    const sectionId = ((await section.json()) as { data: { id: string } }).data.id;

    try {
      await expect(async () => {
        await page.goto("/");
        await expect(page.getByRole("heading", { level: 2, name: heading })).toBeVisible({ timeout: 2_000 });
      }).toPass({ timeout: 20_000 });
      const region = page.locator("section", { has: page.getByRole("heading", { level: 2, name: heading }) });
      await expect(region.getByRole("link", { name: title, exact: true })).toBeVisible();
      await expect(region.getByRole("link", { name: "Lihat semua artikel" })).toHaveAttribute("href", "/artikel");
    } finally {
      await page.request.delete(`/api/admin/home-sections/${sectionId}`, { headers: HEADERS });
    }
  });
});
