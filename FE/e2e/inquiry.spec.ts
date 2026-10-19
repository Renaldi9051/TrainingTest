import { expect, test, type Page } from "@playwright/test";
import { E2E_BE_ORIGIN } from "./e2e-env";
import { createTraining, deleteTraining, firstCategory, loginViaApi, ORIGIN, runId, type CreatedTraining } from "./helpers";

// Inquiry (Fase 4.2): form di detail pelatihan (section inline #inquiry, pelatihan terisi) dan /kontak, persetujuan
// data wajib, error per field dari BE, honeypot, rate limit per IP, admin (status, catatan, CSV)
// dan dashboard. Rate limit BE in-memory: tes API (honeypot, rate limit) memanggil BE e2e langsung
// dengan X-Forwarded-For sendiri (TRUST_PROXY_HOPS=1), supaya tidak menghabiskan jatah IP browser.

const HEADERS = { Origin: ORIGIN };

async function fill(page: Page, scope: ReturnType<Page["locator"]>, values: { name: string; email: string; phone?: string; message?: string }) {
  await scope.getByLabel("Nama lengkap").fill(values.name);
  await scope.getByLabel("Email").fill(values.email);
  if (values.phone) await scope.getByLabel("Nomor WhatsApp (opsional)").fill(values.phone);
  if (values.message) await scope.getByLabel("Pesan (opsional)").fill(values.message);
}

test.describe.configure({ mode: "serial" });
test.describe("inquiry", () => {
  const id = runId();
  let training: CreatedTraining;
  let privacyPageId = "";

  test.beforeAll(async ({ request }) => {
    await loginViaApi(request);
    // Seed minimal e2e tanpa halaman statis: buat Kebijakan Privasi kalau belum ada (untuk link persetujuan).
    const pages = (await (await request.get("/api/admin/pages?pageSize=100")).json()) as { data: { slug: string }[] };
    if (!pages.data.some((page) => page.slug === "kebijakan-privasi")) {
      const created = await request.post("/api/admin/pages", {
        headers: HEADERS,
        data: { title: "Kebijakan Privasi", slug: "kebijakan-privasi", status: "PUBLISHED", blocks: [] },
      });
      expect(created.status(), await created.text()).toBe(201);
      privacyPageId = ((await created.json()) as { data: { id: string } }).data.id;
    }
    const category = await firstCategory(request);
    training = await createTraining(request, { title: `[UJI] Inquiry ${id}`, categoryIds: [category.id], status: "PUBLISHED" });
    await expect.poll(async () => (await request.get(`/pelatihan/${training.slug}`)).status()).toBe(200);
  });

  test.afterAll(async ({ request }) => {
    if (training) await deleteTraining(request, training.id);
    if (privacyPageId) await request.delete(`/api/admin/pages/${privacyPageId}`, { headers: HEADERS });
  });

  test("detail pelatihan: form inline #inquiry dengan pelatihan terisi, persetujuan wajib, error WA dari BE, terkirim", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/pelatihan/${training.slug}`);
    // Tombol "Kirim inquiry" di kartu samping menuju section inline (bukan dialog).
    await page.getByRole("complementary", { name: "Ringkasan pendaftaran" }).getByRole("link", { name: "Kirim inquiry" }).click();
    await expect(page).toHaveURL(/#inquiry$/);
    const section = page.locator("#inquiry");
    await expect(section.getByRole("heading", { level: 2, name: "Tanya atau daftar pelatihan ini" })).toBeInViewport();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(section.getByText(`[UJI] Inquiry ${id}`)).toBeVisible();
    await expect(section.getByRole("link", { name: "Kebijakan Privasi" })).toHaveAttribute("href", "/kebijakan-privasi");
    // Pelatihan tanpa sesi: pilihan sesi tidak tampil.
    await expect(section.getByLabel("Sesi (opsional)")).toHaveCount(0);

    await fill(page, section, { name: `[UJI] Pengirim ${id}`, email: `uji-${id}@example.com`, phone: "12ab", message: "=1+1 tolong penawaran" });
    // Tanpa centang persetujuan: browser menahan kirim (required).
    await section.getByRole("button", { name: "Kirim pesan" }).click();
    await expect(section.getByRole("checkbox")).toHaveJSProperty("validity.valueMissing", true);
    await section.getByRole("checkbox").check();
    await section.getByRole("button", { name: "Kirim pesan" }).click();
    // Error per field dari BE (format WA), fokus ke field itu.
    const phone = section.getByLabel("Nomor WhatsApp (opsional)");
    await expect(phone).toHaveAttribute("aria-invalid", "true");
    await expect(phone).toBeFocused();
    await expect(section.getByText(/Nomor WhatsApp hanya boleh/)).toBeVisible();

    await phone.fill("0812-0000-0099");
    await section.getByRole("button", { name: "Kirim pesan" }).click();
    // Status TERKIRIM (tanpa nomor inquiry), lalu bisa kirim pesan lain.
    await expect(section.getByRole("status")).toContainText("Terkirim");
    await expect(section.getByRole("status")).toContainText("Terima kasih, pesan terkirim.");
    await section.getByRole("button", { name: "Kirim pesan lain" }).click();
    await expect(section.getByRole("button", { name: "Kirim pesan" })).toBeVisible();
  });

  test("/kontak?pelatihan=<slug>: pelatihan terisi otomatis dan bisa dilepas", async ({ page }) => {
    await page.goto(`/kontak?pelatihan=${training.slug}`);
    await expect(page.getByRole("heading", { level: 1, name: "Hubungi kami" })).toBeVisible();
    const form = page.locator("form").filter({ has: page.getByRole("button", { name: "Kirim pesan" }) });
    await expect(form.getByText(`[UJI] Inquiry ${id}`)).toBeVisible();
    await form.getByRole("button", { name: `Lepas pelatihan [UJI] Inquiry ${id}` }).click();
    await expect(form.getByLabel("Pelatihan yang diminati (opsional)")).toBeVisible();
    // Slug yang tidak ada diabaikan.
    await page.goto("/kontak?pelatihan=tidak-ada-sama-sekali");
    await page.waitForTimeout(500);
    await expect(page.getByLabel("Pelatihan yang diminati (opsional)")).toBeVisible();
  });

  test("honeypot terisi: dibalas sukses tetapi tidak tersimpan", async ({ page, playwright }) => {
    const bot = `[UJI] Bot ${id}`;
    const be = await playwright.request.newContext({ baseURL: E2E_BE_ORIGIN });
    const response = await be.post("/api/public/inquiries", {
      headers: { ...HEADERS, "X-Forwarded-For": `10.9.${Math.floor(Math.random() * 200)}.1` },
      data: { name: bot, email: `bot-${id}@example.com`, consent: true, website: "https://spam.example" },
    });
    expect(response.status()).toBe(201);
    await be.dispose();
    await loginViaApi(page.request);
    const list = await page.request.get(`/api/admin/inquiries?q=${encodeURIComponent(`Bot ${id}`)}`);
    expect(((await list.json()) as { data: unknown[] }).data).toHaveLength(0);
  });

  test("rate limit: kiriman ke-6 dari IP yang sama dalam 10 menit = 429 + Retry-After", async ({ playwright }) => {
    const request = await playwright.request.newContext({ baseURL: E2E_BE_ORIGIN });
    const ip = `10.8.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200)}`;
    const send = (n: number) =>
      request.post("/api/public/inquiries", {
        headers: { ...HEADERS, "X-Forwarded-For": ip },
        data: { name: `[UJI] Batas ${id}`, email: `batas-${n}-${id}@example.com`, consent: true },
      });
    for (let n = 0; n < 5; n++) expect((await send(n)).status()).toBe(201);
    const blocked = await send(5);
    expect(blocked.status()).toBe(429);
    expect(Number(blocked.headers()["retry-after"])).toBeGreaterThan(0);
    expect(((await blocked.json()) as { error: { message: string } }).error.message).toContain("Coba lagi dalam");
    await request.dispose();
  });

  test("admin: tampil di dashboard & daftar, ubah status + catatan, ekspor CSV aman (BOM, escape formula)", async ({ page }) => {
    await loginViaApi(page.request);
    await page.goto("/admin");
    // Kartu Inquiry baru terisi (5 terbaru bisa berisi kiriman tes rate limit, jadi cek jumlah + tautan).
    const newCount = page.getByRole("link", { name: /^\d+$/ }).and(page.locator('[href="/admin/inquiries?status=NEW"]'));
    await expect(newCount).toBeVisible();
    expect(Number(await newCount.textContent())).toBeGreaterThan(0);
    // Badge sidebar.
    await expect(page.getByText("inquiry baru", { exact: false }).first()).toBeAttached();

    await page.goto("/admin/inquiries?status=NEW");
    await page.getByRole("searchbox").fill(`Pengirim ${id}`);
    await page.getByRole("link", { name: `[UJI] Pengirim ${id}` }).click();
    await expect(page.getByRole("heading", { level: 1, name: `[UJI] Pengirim ${id}` })).toBeVisible();
    await expect(page.getByRole("link", { name: `[UJI] Inquiry ${id}` })).toHaveAttribute("href", `/admin/trainings/${training.id}`);
    await expect(page.getByText("+6281200000099")).toBeVisible();
    await expect(page.getByText(/versi teks 2026-10/)).toBeVisible();

    await page.getByRole("combobox", { name: "Status" }).click();
    await page.getByRole("option", { name: "Diproses" }).click();
    await expect(page.locator("[data-sonner-toast]").filter({ hasText: "Status diubah ke Diproses." }).first()).toBeVisible();
    await page.getByLabel("Catatan internal").fill("Sudah ditelepon.");
    await page.getByRole("button", { name: "Simpan catatan" }).click();
    await expect(page.locator("[data-sonner-toast]").filter({ hasText: "Catatan disimpan." }).first()).toBeVisible();

    const csv = await page.request.get("/api/admin/inquiries/export?status=IN_PROGRESS");
    expect(csv.status()).toBe(200);
    expect(csv.headers()["content-type"]).toContain("text/csv");
    expect(csv.headers()["content-disposition"]).toMatch(/attachment; filename="inquiry-\d{4}-\d{2}-\d{2}\.csv"/);
    const bytes = await csv.body();
    expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const text = bytes.toString("utf8");
    expect(text).toContain(`"[UJI] Pengirim ${id}"`);
    expect(text).toContain(`"'=1+1 tolong penawaran"`);
    expect(text.split("\r\n")[0]).toContain('";"');
  });

  test("endpoint admin inquiry tanpa sesi = 401", async ({ playwright }) => {
    const anon = await playwright.request.newContext({ baseURL: ORIGIN });
    for (const path of ["/api/admin/inquiries", "/api/admin/inquiries/count", "/api/admin/inquiries/export"]) {
      expect((await anon.get(path)).status(), path).toBe(401);
    }
    await anon.dispose();
  });
});
