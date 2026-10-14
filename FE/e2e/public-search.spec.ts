import { expect, test, type Page } from "@playwright/test";
import { E2E_BE_ORIGIN } from "./e2e-env";
import { createTraining, deleteTraining, loginViaApi, ORIGIN, runId, type CreatedTraining } from "./helpers";

// Search publik (4.4c/4.4d): palette Ctrl/Cmd+K di header, hanya konten yang tampil publik (draf dan
// terjadwal tidak bocor), rate limit per IP, Cache-Control. Data uji berawalan [UJI].

const palette = (page: Page) => page.getByRole("dialog", { name: "Cari pelatihan" });
const searchInput = (page: Page) => palette(page).getByRole("combobox", { name: "Kata kunci" });

// Tombol & shortcut baru aktif setelah hidrasi; tekan lagi hanya kalau palette belum terbuka.
async function openWith(page: Page, open: () => Promise<void>) {
  await expect(async () => {
    if (!(await palette(page).isVisible())) await open();
    await expect(palette(page)).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
}

test.describe.configure({ mode: "serial" });
test.describe("search publik", () => {
  const id = runId();
  // Satu token unik di semua judul uji supaya hasil pencarian pasti hanya data uji ini.
  const token = `zq${id}`;
  const created: CreatedTraining[] = [];
  const categoryIds: string[] = [];
  let published: CreatedTraining;
  const mixedName = `[UJI] Kategori campur ${token}`;
  const draftOnlyName = `[UJI] Kategori draf ${token}`;

  test.beforeAll(async ({ request }) => {
    await loginViaApi(request);
    const category = async (name: string) => {
      const response = await request.post("/api/admin/categories", { headers: { Origin: ORIGIN }, data: { name } });
      expect(response.status(), await response.text()).toBe(201);
      const { id } = ((await response.json()) as { data: { id: string } }).data;
      categoryIds.push(id);
      return id;
    };
    // Kategori campur: 1 tayang + 1 draf + 1 terjadwal. Kategori draf: hanya berisi draf.
    const mixed = await category(mixedName);
    const draftOnly = await category(draftOnlyName);
    const base = { categoryIds: [mixed], summary: `Ringkasan uji ${token}.` };
    published = await createTraining(request, { ...base, title: `[UJI] Terbuka ${token}`, status: "PUBLISHED" });
    created.push(published);
    created.push(await createTraining(request, { ...base, title: `[UJI] Rahasia draf ${token}`, status: "DRAFT" }));
    const nextYear = new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString();
    created.push(await createTraining(request, { ...base, title: `[UJI] Rahasia terjadwal ${token}`, status: "PUBLISHED", publishedAt: nextYear }));
    created.push(await createTraining(request, { ...base, categoryIds: [draftOnly], title: `[UJI] Rahasia isi kategori ${token}`, status: "DRAFT" }));
  });

  test.afterAll(async ({ request }) => {
    for (const training of created) await deleteTraining(request, training.id);
    for (const id of categoryIds) await request.delete(`/api/admin/categories/${id}`, { headers: { Origin: ORIGIN } });
  });

  test("API: hanya yang tampil publik; draf & terjadwal tidak bocor; Cache-Control singkat; 422 untuk 1 huruf", async ({ request }) => {
    await expect
      .poll(async () => {
        const response = await request.get(`/api/public/search?q=${token}`);
        return ((await response.json()) as { data: { groups: { items: { title: string }[] }[] } }).data.groups.flatMap((group) => group.items.map((item) => item.title));
      })
      .toEqual([`[UJI] Terbuka ${token}`]);
    const response = await request.get(`/api/public/search?q=${encodeURIComponent(`Rahasia ${token}`)}`);
    expect(response.status()).toBe(200);
    expect(response.headers()["cache-control"]).toBe("public, max-age=30, stale-while-revalidate=30");
    const body = await response.text();
    const { data } = JSON.parse(body) as { data: { groups: { items: { title: string }[] }[] } };
    // Hanya yang tayang; judul draf/terjadwal tidak ada di hasil (q sendiri memang menggemakan kata kunci).
    expect(data.groups.flatMap((group) => group.items.map((item) => item.title))).toEqual([`[UJI] Terbuka ${token}`]);
    // Respons tanpa id/status.
    expect(body).not.toMatch(/"(id|status)":/);
    expect((await request.get("/api/public/search?q=a")).status()).toBe(422);
  });

  test("kategori: jumlah hanya pelatihan tayang; kategori yang hanya berisi draf tidak muncul", async ({ request }) => {
    type Body = { data: { groups: { group: string; items: { title: string; trainingCount?: number }[] }[] } };
    const categories = async () => {
      const response = await request.get(`/api/public/search?q=${encodeURIComponent(`Kategori ${token}`)}`);
      return ((await response.json()) as Body).data.groups.find((group) => group.group === "categories")?.items ?? [];
    };
    await expect.poll(categories).toEqual([{ slug: expect.any(String), title: mixedName, meta: null, trainingCount: 1 }]);
  });

  test("rate limit per IP: permintaan ke-301 dalam 1 menit = 429 + Retry-After + no-store", async ({ playwright }) => {
    test.setTimeout(120_000);
    const be = await playwright.request.newContext({ baseURL: E2E_BE_ORIGIN });
    const ip = `10.7.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200)}`;
    const search = () => be.get("/api/public/search?q=drone", { headers: { "X-Forwarded-For": ip } });
    // 300/menit per IP: longgar untuk pengunjung instansi yang berbagi satu IP (NAT).
    for (let n = 0; n < 300; n++) expect((await search()).status()).toBe(200);
    const blocked = await search();
    expect(blocked.status()).toBe(429);
    expect(Number(blocked.headers()["retry-after"])).toBeGreaterThan(0);
    expect(blocked.headers()["cache-control"]).toBe("no-store");
    // IP lain tidak terpengaruh.
    expect((await be.get("/api/public/search?q=drone", { headers: { "X-Forwarded-For": `${ip}9` } })).status()).toBe(200);
    await be.dispose();
  });

  test("Ctrl/Cmd+K membuka palette; hasil publik saja; Enter membuka detail pelatihan", async ({ page }) => {
    await page.goto("/");
    const trigger = page.getByRole("link", { name: "Cari pelatihan" });
    await expect(trigger).toHaveAttribute("aria-keyshortcuts", "Control+K Meta+K");
    // Palette belum dimuat sebelum dibuka (kode dimuat lazy).
    await expect(palette(page)).toHaveCount(0);
    await openWith(page, () => page.keyboard.press("ControlOrMeta+K"));
    await searchInput(page).fill(token);
    const option = palette(page).getByRole("option", { name: new RegExp(`Terbuka ${token}`) });
    await expect(option).toHaveAttribute("aria-selected", "true");
    await expect(palette(page).getByRole("option", { name: /Rahasia/ })).toHaveCount(0);
    await expect(palette(page).getByRole("option", { name: new RegExp(`Lihat semua hasil untuk "${token}"`) })).toHaveAttribute("href", `/pelatihan?q=${token}`);
    await searchInput(page).press("Enter");
    await expect(page).toHaveURL(new RegExp(`/pelatihan/${published.slug}$`));
    await expect(page.getByRole("heading", { level: 1, name: `[UJI] Terbuka ${token}` })).toBeVisible();
  });

  test("klik tombol membuka palette; Esc menutup dan fokus kembali ke tombol; kata kunci tanpa hasil", async ({ page }) => {
    await page.goto("/");
    const trigger = page.getByRole("link", { name: "Cari pelatihan" });
    await openWith(page, () => trigger.click());
    await expect(page).toHaveURL(/\/$/);
    // Kata acak tanpa kemiripan (trigram) dengan judul apa pun.
    await searchInput(page).fill("wqxzvwqxzv");
    await expect(palette(page)).toContainText(`Tidak ada hasil untuk "wqxzvwqxzv"`);
    await page.keyboard.press("Escape");
    await expect(palette(page)).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("menu mobile: 'Cari pelatihan' menutup menu dan membuka palette", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto("/");
    const mobileSearch = page.getByRole("navigation", { name: "Menu utama (mobile)" }).getByRole("link", { name: "Cari pelatihan" });
    // Tombol baru aktif setelah hidrasi; klik "Buka menu" hanya selama menu masih tertutup.
    await expect(async () => {
      if (!(await mobileSearch.isVisible())) await page.getByRole("button", { name: "Buka menu" }).click();
      await expect(mobileSearch).toBeVisible({ timeout: 1_000 });
    }).toPass({ timeout: 15_000 });
    await mobileSearch.click();
    await expect(palette(page)).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
  });
});
