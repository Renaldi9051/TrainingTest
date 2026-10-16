import { mkdirSync } from "node:fs";
import path from "node:path";
import { expect, test, type APIRequestContext } from "@playwright/test";
import { createTraining, deleteTraining, loginViaApi, ORIGIN, runId, type CreatedTraining } from "./helpers";

// Jadwal, kontak, halaman statis redesign v0.2 (fase 6): list & kalender (sesi multi-hari di tanggal
// mulai dengan rentang di teks), empty state dengan ajakan in-house, blok jadwal kosong disembunyikan
// di detail pelatihan & landing kategori, kontak (jam operasional, koordinat, area marketing), halaman
// statis (diperbarui, tab halaman lain, daftar isi). Data uji hanya di training_e2e; pengaturan
// dikembalikan di akhir.
// Screenshot 360/768/1280 (opsional): SCREENS_OUT=<folder> npx playwright test e2e/schedule-contact-pages.spec.ts

const HEADERS = { Origin: ORIGIN };
const CITY = "Kota Kalender Uji";

type Created = { id: string; slug?: string };

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

async function send<T = Created>(request: APIRequestContext, method: "POST" | "PATCH" | "PUT", url: string, data: unknown): Promise<T> {
  const response = await request.fetch(`/api${url}`, { method, headers: HEADERS, data });
  expect(response.status(), await response.text()).toBeLessThan(300);
  return ((await response.json()) as { data: T }).data;
}

// Bulan depan (UTC) sebagai "YYYY-MM" dan tanggal di bulan itu.
function nextMonth(): { month: string; day: (value: number) => string } {
  const now = new Date();
  const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const month = first.toISOString().slice(0, 7);
  return { month, day: (value) => `${month}-${String(value).padStart(2, "0")}` };
}

test.describe.configure({ mode: "serial" });

test.describe("jadwal, kontak, halaman statis v0.2", () => {
  const id = runId();
  const { month, day } = nextMonth();
  let scheduled: CreatedTraining;
  let lonely: CreatedTraining;
  let categoryId = "";
  let categorySlug = "";
  let scheduleId = "";
  let marketingId = "";
  const pages: Created[] = [];
  let originalContact: unknown = null;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ baseURL: ORIGIN });
    const request = context.request;
    await loginViaApi(request);
    const settings = (await (await request.get("/api/admin/settings")).json()) as { data: { values: Record<string, unknown> } };
    originalContact = settings.data.values["site.contact"];

    // Kategori uji: satu pelatihan bersesi, satu tanpa sesi (kategori tanpa sesi sama sekali diuji terpisah).
    const category = await send(request, "POST", "/admin/categories", { name: `[UJI] Kategori jadwal ${id}` });
    categoryId = category.id;
    categorySlug = category.slug ?? "";
    scheduled = await createTraining(request, { title: `[UJI] Terjadwal ${id}`, categoryIds: [categoryId], status: "PUBLISHED" });
    lonely = await createTraining(request, { title: `[UJI] Tanpa sesi ${id}`, categoryIds: [categoryId], status: "PUBLISHED" });
    scheduleId = (
      await send(request, "POST", "/admin/schedules", {
        trainingId: scheduled.id,
        startDate: day(12),
        endDate: day(14),
        city: CITY,
        method: "OFFLINE",
        status: "OPEN",
      })
    ).id;
    marketingId = (await send(request, "POST", "/admin/marketing", { name: `[UJI] Marketing ${id}`, phone: "081200000888", area: "Instansi pemerintah" })).id;
    pages.push(
      await send(request, "POST", "/admin/pages", {
        title: `[UJI] Kebijakan uji ${id}`,
        status: "PUBLISHED",
        blocks: [
          { id: crypto.randomUUID(), type: "LIST", eyebrow: "", heading: "Data yang dikumpulkan", style: "bullet", items: ["Nama", "Email"] },
          { id: crypto.randomUUID(), type: "LIST", eyebrow: "", heading: "Penggunaan data", style: "bullet", items: ["Menindaklanjuti permintaan"] },
        ],
      }),
      // Halaman kedua: tab "Halaman lain" hanya tampil kalau ada minimal 2 halaman statis.
      await send(request, "POST", "/admin/pages", {
        title: `[UJI] Syarat uji ${id}`,
        status: "PUBLISHED",
        blocks: [{ id: crypto.randomUUID(), type: "LIST", eyebrow: "", heading: "Ketentuan", style: "bullet", items: ["Satu"] }],
      }),
    );
    await expect.poll(async () => (await request.get(`/jadwal?kota=${encodeURIComponent(CITY)}`)).text(), { timeout: 10_000 }).toContain(scheduled.title);
    await context.close();
  });

  test.afterAll(async ({ browser }) => {
    const context = await browser.newContext({ baseURL: ORIGIN });
    const request = context.request;
    await loginViaApi(request);
    if (originalContact) await send(request, "PUT", "/admin/settings/site.contact", originalContact);
    if (scheduleId) await request.delete(`/api/admin/schedules/${scheduleId}`, { headers: HEADERS });
    for (const training of [scheduled, lonely]) if (training) await deleteTraining(request, training.id);
    if (categoryId) await request.delete(`/api/admin/categories/${categoryId}`, { headers: HEADERS });
    if (marketingId) await request.delete(`/api/admin/marketing/${marketingId}`, { headers: HEADERS });
    for (const page of pages) await request.delete(`/api/admin/pages/${page.id}`, { headers: HEADERS });
    await context.close();
  });

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
  });

  test("jadwal: list dan kalender; sesi multi-hari di tanggal mulai dengan rentang di teks", async ({ page }) => {
    await page.goto(`/jadwal?kota=${encodeURIComponent(CITY)}`);
    await expect(page.getByRole("heading", { level: 1, name: "Jadwal pelatihan" })).toBeVisible();
    await expect(page.getByRole("link", { name: scheduled.title })).toBeVisible();

    await page.getByRole("group", { name: "Tampilan" }).getByRole("link", { name: "Kalender" }).click();
    await expect(page).toHaveURL(/tampilan=kalender/);
    // Bulan depan (sesi uji ada di sana).
    await page.goto(`/jadwal?kota=${encodeURIComponent(CITY)}&tampilan=kalender&bulan=${month}`);
    const calendar = page.getByRole("table", { name: /Kalender sesi/ });
    await expect(calendar).toBeVisible();
    const startCell = calendar.getByRole("cell").filter({ has: page.getByRole("link", { name: new RegExp(escapeRegExp(scheduled.title)) }) });
    await expect(startCell).toHaveCount(1);
    await expect(startCell).toContainText(/^12/);
    await expect(startCell.getByRole("link")).toContainText(/12-14 [A-Z]{3} \/ KOTA KALENDER UJI/i);
    // Navigasi bulan lewat tombol.
    await page.getByRole("link", { name: "Bulan berikutnya" }).click();
    await expect(page).toHaveURL(/bulan=\d{4}-\d{2}/);

    // Layar kecil: agenda per tanggal (tabel disembunyikan karena ada sesi).
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto(`/jadwal?kota=${encodeURIComponent(CITY)}&tampilan=kalender&bulan=${month}`);
    await expect(page.getByRole("table", { name: /Kalender sesi/ })).toBeHidden();
    await expect(page.getByRole("link", { name: new RegExp(escapeRegExp(scheduled.title)) })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });

  test("jadwal kosong: list dan kalender (grid tetap tampil) dengan ajakan in-house ke /kontak", async ({ page }) => {
    await page.goto("/jadwal?kota=Kota%20Tanpa%20Sesi");
    await expect(page.getByText("Belum ada sesi untuk filter ini.")).toBeVisible();
    await expect(page.getByRole("link", { name: /Ajukan jadwal in-house/ }).first()).toHaveAttribute("href", "/kontak");

    await page.goto("/jadwal?kota=Kota%20Tanpa%20Sesi&tampilan=kalender");
    await expect(page.getByText("Belum ada sesi di bulan ini.")).toBeVisible();
    await expect(page.getByRole("table", { name: /Kalender sesi/ })).toBeVisible();
    await page.setViewportSize({ width: 390, height: 800 });
    await page.reload();
    await expect(page.getByRole("table", { name: /Kalender sesi/ })).toBeVisible();
  });

  test("blok jadwal kosong disembunyikan: detail pelatihan tanpa sesi, landing kategori tanpa sesi", async ({ page }) => {
    await page.goto(`/pelatihan/${lonely.slug}`);
    await expect(page.getByRole("heading", { level: 1, name: lonely.title })).toBeVisible();
    // Tanpa tabel jadwal dan tanpa label "Sesi berikut"; kartu samping menulis "Jadwal menyesuaikan".
    await expect(page.locator("#jadwal table")).toHaveCount(0);
    await expect(page.getByText(/Sesi berikut/)).toHaveCount(0);
    await expect(page.getByRole("complementary", { name: "Ringkasan pendaftaran" })).toContainText("Jadwal menyesuaikan");

    await page.goto(`/pelatihan/${scheduled.slug}`);
    await expect(page.locator("#jadwal table")).toHaveCount(1);

    // Kategori tanpa sesi sama sekali.
    await loginViaApi(page.request);
    const empty = await send(page.request, "POST", "/admin/categories", { name: `[UJI] Kategori kosong ${id}` });
    const solo = await createTraining(page.request, { title: `[UJI] Solo ${id}`, categoryIds: [empty.id], status: "PUBLISHED" });
    try {
      await page.goto(`/pelatihan/kategori/${empty.slug}`);
      await expect(page.getByRole("heading", { level: 1, name: `[UJI] Kategori kosong ${id}` })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Sesi terdekat" })).toHaveCount(0);
      await page.goto(`/pelatihan/kategori/${categorySlug}`);
      await expect(page.getByRole("heading", { name: "Sesi terdekat" })).toBeVisible();
    } finally {
      await deleteTraining(page.request, solo.id);
      await page.request.delete(`/api/admin/categories/${empty.id}`, { headers: HEADERS });
    }
  });

  test("kontak: strip info, jam operasional, koordinat + Google Maps, area marketing", async ({ page }) => {
    await page.goto("/kontak");
    await expect(page.getByRole("heading", { level: 1, name: "Hubungi kami" })).toBeVisible();
    await expect(page.getByText("Jam operasional")).toHaveCount(0);
    const marketing = page.locator("#tim-marketing");
    await expect(marketing.getByText("Instansi pemerintah")).toBeVisible();

    await loginViaApi(page.request);
    await page.goto("about:blank");
    await send(page.request, "PUT", "/admin/settings/site.contact", {
      ...(originalContact as object),
      openingHours: "Senin-Jumat 08.00-16.00",
      latitude: -7.7156,
      longitude: 110.355,
      mapEmbedUrl: (originalContact as { mapEmbedUrl: string }).mapEmbedUrl || "https://www.openstreetmap.org/export/embed.html?bbox=110.3,-7.75,110.4,-7.7",
    });
    await expect.poll(async () => (await (await page.request.get("/kontak")).text()).includes("Senin-Jumat"), { timeout: 5_000 }).toBe(true);
    await page.goto("/kontak");
    await expect(page.getByText("Jam operasional")).toBeVisible();
    await expect(page.getByText("Senin-Jumat 08.00-16.00")).toBeVisible();
    await expect(page.getByText(/Lat -7.7156 \/ Lon 110.355/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /Buka di Google Maps/ })).toHaveAttribute("href", /maps\/search\/\?api=1&query=-7.7156,110.355/);
  });

  test("halaman statis: diperbarui, tab halaman lain, daftar isi dari judul blok", async ({ page }) => {
    const created = pages[0] as Created & { slug: string };
    await page.goto(`/${created.slug}`);
    await expect(page.getByRole("heading", { level: 1, name: `[UJI] Kebijakan uji ${id}` })).toBeVisible();
    await expect(page.getByText(/Diperbarui \/ \d{2} [A-Z]{3} \d{4}/)).toBeVisible();
    const tabs = page.getByRole("navigation", { name: "Halaman lain" });
    await expect(tabs.locator('a[aria-current="page"]')).toHaveText(`[UJI] Kebijakan uji ${id}`);
    await expect(tabs.getByRole("link", { name: `[UJI] Syarat uji ${id}` })).toBeVisible();
    const toc = page.getByRole("navigation", { name: "Daftar isi" });
    await expect(toc.getByRole("link")).toHaveText(["Data yang dikumpulkan", "Penggunaan data"]);
    await toc.getByRole("link", { name: "Penggunaan data" }).click();
    await expect(page).toHaveURL(/#bagian-2$/);
    await expect(page.getByRole("link", { name: "Hubungi kami" }).last()).toHaveAttribute("href", "/kontak");
  });

  test("screenshot jadwal (list & kalender), kontak, halaman statis di 360/768/1280", async ({ page }) => {
    const out = process.env.SCREENS_OUT;
    test.skip(!out, "Butuh SCREENS_OUT.");
    test.setTimeout(240_000);
    const dir = out ?? "";
    mkdirSync(dir, { recursive: true });
    const created = pages[0] as Created & { slug: string };
    const shots: [string, string][] = [
      ["jadwal-list", "/jadwal"],
      ["jadwal-kalender", `/jadwal?tampilan=kalender&bulan=${month}`],
      ["kontak", "/kontak"],
      ["halaman-statis", `/${created.slug}`],
    ];
    for (const width of [360, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      for (const [name, url] of shots) {
        await page.goto(url);
        await page.evaluate(async () => {
          for (let y = 0; y < document.body.scrollHeight; y += 400) {
            window.scrollTo(0, y);
            await new Promise((resolve) => setTimeout(resolve, 60));
          }
          window.scrollTo(0, 0);
        });
        await page.waitForTimeout(700);
        await page.screenshot({ path: path.join(dir, `${name}-${width}.png`), fullPage: true });
      }
    }
  });
});
