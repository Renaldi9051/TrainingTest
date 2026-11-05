import { expect, test, type APIRequestContext } from "@playwright/test";
import { createTraining, deleteTraining, firstCategory, loginViaApi, ORIGIN, runId, type CreatedTraining } from "./helpers";

// Alur kritis Fase 2: pelatihan dari admin tampil di halaman kategori & detail publik < 5 detik,
// draft tidak tampil, pencarian judul lewat palette, grid kategori /pelatihan (cari, paginasi,
// URL lama), 404 sungguhan, pratinjau draft khusus admin.

const PUBLISH_DEADLINE_MS = 5_000;
const created: CreatedTraining[] = [];

async function cleanup(request: APIRequestContext) {
  for (const training of created.splice(0)) await deleteTraining(request, training.id);
}

test.describe("katalog & detail pelatihan", () => {
  test.afterEach(async ({ page }) => {
    await cleanup(page.request);
  });

  test("admin membuat & menayangkan pelatihan, tampil di katalog dan detail < 5 detik, lalu judul diubah", async ({
    page,
  }) => {
    await loginViaApi(page.request);
    const category = await firstCategory(page.request);
    const id = runId();
    const title = `Pelatihan E2E Tayang ${id}`;

    await page.goto("/admin/trainings/new");
    await page.getByRole("textbox", { name: "Judul", exact: true }).fill(title);
    await page.getByRole("textbox", { name: "Ringkasan", exact: true }).fill(`Ringkasan pelatihan uji ${id}.`);
    await page.getByPlaceholder("Cari kategori").fill(category.name);
    await page.getByRole("radio", { name: category.name, exact: true }).click();
    // Status Tayang wajib 4 hasil belajar.
    for (let index = 1; index <= 4; index += 1) {
      await page.getByRole("button", { name: "Tambah hasil belajar" }).click();
      await page.getByLabel(`Hasil belajar ${index}`, { exact: true }).fill(`Hasil belajar uji ${index}`);
    }
    await page.getByRole("radio", { name: /Tayang/ }).check();
    await page.getByRole("button", { name: "Simpan", exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/trainings\/[0-9a-f-]{36}$/);
    const trainingId = page.url().split("/").pop() ?? "";
    const saved = await (await page.request.get(`/api/admin/trainings/${trainingId}`)).json();
    const slug: string = saved.data.slug;
    created.push({ id: trainingId, slug, title });
    expect(saved.data.publicState).toBe("PUBLISHED");

    // Sejak tersimpan: halaman publik (detail + daftar judul di halaman kategori) harus menampilkan judul < 5 detik.
    const savedAt = Date.now();
    await expect
      .poll(async () => (await page.request.get(`/pelatihan/${slug}`)).status(), { timeout: PUBLISH_DEADLINE_MS })
      .toBe(200);
    await expect
      .poll(async () => (await (await page.request.get(`/pelatihan/kategori/${category.slug}`)).text()).includes(title), {
        timeout: PUBLISH_DEADLINE_MS,
      })
      .toBe(true);
    expect(Date.now() - savedAt).toBeLessThan(PUBLISH_DEADLINE_MS);

    await page.goto(`/pelatihan/${slug}`);
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();

    // Ubah judul di admin: halaman publik ikut berubah < 5 detik tanpa redeploy.
    const renamed = `${title} Edisi Baru`;
    await page.goto(`/admin/trainings/${trainingId}`);
    await page.getByRole("textbox", { name: "Judul", exact: true }).fill(renamed);
    await page.getByRole("button", { name: "Simpan", exact: true }).click();
    await expect(page.getByText(/Pelatihan disimpan/).first()).toBeVisible();
    const renamedAt = Date.now();
    await expect
      .poll(async () => (await (await page.request.get(`/pelatihan/${slug}`)).text()).includes(renamed), {
        timeout: PUBLISH_DEADLINE_MS,
      })
      .toBe(true);
    expect(Date.now() - renamedAt).toBeLessThan(PUBLISH_DEADLINE_MS);
  });

  test("draft tidak tampil di publik; pratinjau hanya untuk admin", async ({ page, browser }) => {
    await loginViaApi(page.request);
    const category = await firstCategory(page.request);
    const id = runId();
    const draft = await createTraining(page.request, {
      title: `Draf E2E ${id}`,
      summary: `Ringkasan draf ${id}`,
      categoryIds: [category.id],
      status: "DRAFT",
    });
    created.push(draft);

    // Pengunjung (konteks terpisah tanpa sesi): 404 dan tidak muncul di pencarian.
    const visitor = await browser.newContext();
    const response = await visitor.request.get(`/pelatihan/${draft.slug}`);
    expect(response.status()).toBe(404);
    const search = await visitor.request.get(`/pelatihan/kategori/${category.slug}`);
    expect(await search.text()).not.toContain(draft.title);
    // Route pratinjau tanpa sesi diarahkan ke login, bukan menampilkan draf.
    const visitorPage = await visitor.newPage();
    await visitorPage.goto(`/admin/preview?type=training&id=${draft.id}`);
    await expect(visitorPage).toHaveURL(/\/admin\/login/);
    await visitor.close();

    // Admin: pratinjau lewat draft mode.
    await page.goto(`/admin/preview?type=training&id=${draft.id}`);
    await expect(page).toHaveURL(new RegExp(`/pelatihan/${draft.slug}$`));
    await expect(page.getByText("Mode pratinjau")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: draft.title })).toBeVisible();
    await page.getByRole("button", { name: "Keluar dari pratinjau" }).click();
    await expect
      .poll(async () => (await page.request.get(`/pelatihan/${draft.slug}`)).status())
      .toBe(404);
  });

  test("command palette menemukan pelatihan dari kata di ringkasan (pencarian judul pindah dari /pelatihan)", async ({ page }) => {
    await loginViaApi(page.request);
    const category = await firstCategory(page.request);
    const word = `zebra${runId()}`;
    const training = await createTraining(page.request, {
      title: `Pelatihan Pencarian ${runId()}`,
      summary: `Materi khusus tentang ${word} untuk uji pencarian.`,
      categoryIds: [category.id],
      status: "PUBLISHED",
    });
    created.push(training);

    await expect
      .poll(async () => (await (await page.request.get(`/api/public/search?q=${word}`)).text()).includes(training.title))
      .toBe(true);
    await page.goto("/pelatihan");
    // Petunjuk "Tekan Ctrl K" di kepala halaman juga bisa diklik.
    await page.getByRole("button", { name: /Cari judul pelatihan\? Tekan/ }).click();
    const palette = page.getByRole("dialog", { name: "Cari pelatihan" });
    await expect(palette).toBeVisible();
    await palette.getByRole("combobox", { name: "Kata kunci" }).fill(word);
    await expect(palette.getByRole("option", { name: new RegExp(training.title) })).toBeVisible();
  });

  // Keputusan atasan 5 Nov 2026: /pelatihan = grid kategori (cari nama kategori, paginasi 24).
  test("grid kategori: urutan dari API, cari kategori (debounce, tanpa reload), kosong, klik kartu ke halaman kategori", async ({ page }) => {
    const api = (await (await page.request.get("/api/public/categories?page=1")).json()) as {
      data: { slug: string; name: string; featured: boolean }[];
      meta: { total: number; totalPages: number };
    };
    await page.goto("/pelatihan");
    await expect(page.getByRole("heading", { level: 1, name: "Pilih kategori pelatihan" })).toBeVisible();
    // Tidak ada lagi sidebar filter, urutan, chip filter aktif, atau kartu pelatihan.
    await expect(page.getByRole("complementary", { name: "Filter" })).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "Urutkan" })).toHaveCount(0);
    await expect(page.locator("article[data-cursor-label]")).toHaveCount(0);

    const cards = page.locator("[data-category-card]");
    await expect(cards).toHaveCount(api.data.length);
    expect(await cards.evaluateAll((links) => links.map((link) => link.getAttribute("data-category-card")))).toEqual(
      api.data.map((category) => category.slug),
    );
    await expect(page.getByRole("status").filter({ hasText: /kategori$/i })).toHaveText(new RegExp(`^${api.meta.total.toLocaleString("id-ID")} kategori$`, "i"));
    const featured = api.data.find((category) => category.featured);
    // Unggulan tidak berbadge per kartu; kartunya masuk kelompok "Kategori unggulan".
    if (featured) {
      const group = page.locator('[data-category-group="unggulan"]');
      await expect(group.getByRole("heading", { level: 2, name: "Kategori unggulan" })).toBeVisible();
      await expect(group.locator(`[data-category-card="${featured.slug}"]`)).toBeVisible();
    }

    // Ketik tanpa Enter: URL berubah setelah jeda (tanpa reload penuh: penanda window tetap ada).
    const target = api.data[api.data.length - 1];
    await page.evaluate(() => Object.assign(window, { __sameDocument: true }));
    await page.getByRole("searchbox", { name: "Cari kategori" }).fill(target.name.toUpperCase());
    await page.waitForURL((url) => url.searchParams.get("q") === target.name.toUpperCase());
    await expect(page.getByRole("status").filter({ hasText: /kategori cocok/i })).toBeVisible();
    await expect(page.locator(`[data-category-card="${target.slug}"]`)).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __sameDocument?: boolean }).__sameDocument)).toBe(true);

    await page.locator(`[data-category-card="${target.slug}"]`).click();
    await expect(page).toHaveURL(new RegExp(`/pelatihan/kategori/${target.slug}$`));
    await expect(page.getByRole("heading", { level: 1, name: target.name })).toBeVisible();

    // Tanpa JS pun jalan: GET ?q= (input terisi dari URL). Tidak cocok: empty state + saran Ctrl K.
    const missing = `tidakadasamasekali${runId()}`;
    await page.goto(`/pelatihan?q=${missing}`);
    await expect(page.getByRole("searchbox", { name: "Cari kategori" })).toHaveValue(missing);
    await expect(page.getByText(`Kategori “${missing}” tidak ditemukan`)).toBeVisible();
    await expect(page.locator("#konten").getByRole("button", { name: /Tekan/ })).toHaveCount(2);
    await expect(page.getByRole("link", { name: "Lihat semua kategori" })).toHaveAttribute("href", "/pelatihan");
  });

  // Keputusan pemilik 5 Nov 2026: indeks huruf A-Z; huruf & kata cari saling menggantikan.
  test("grid kategori: indeks huruf menyaring huruf awal, huruf kosong nonaktif, huruf & cari saling menggantikan", async ({ page }) => {
    const all = (await (await page.request.get("/api/public/categories")).json()) as { data: { slug: string; name: string }[] };
    const letterOf = (name: string) => {
      const first = name.normalize("NFKD").replace(/\p{M}/gu, "").trim().charAt(0).toUpperCase();
      return /^[A-Z]$/.test(first) ? first : "#";
    };
    const letters = new Set(all.data.map((category) => letterOf(category.name)));
    const letter = letterOf(all.data[0].name);
    const expected = all.data.filter((category) => letterOf(category.name) === letter).map((category) => category.slug).sort();
    const empty = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"].find((candidate) => !letters.has(candidate));

    await page.goto("/pelatihan?q=sembarang");
    const index = page.getByRole("navigation", { name: "Indeks huruf kategori" });
    const letterName = letter === "#" ? "Angka dan simbol" : `Huruf ${letter}`;
    await index.getByRole("link", { name: new RegExp(`^${letterName},`) }).click();
    await page.waitForURL((url) => url.searchParams.get("huruf") === letter && !url.searchParams.has("q"));
    await expect(page.getByRole("searchbox", { name: "Cari kategori" })).toHaveValue("");
    await expect(index.getByRole("link", { name: new RegExp(`^${letterName},`) })).toHaveAttribute("aria-current", "true");
    await expect(page.getByRole("status").filter({ hasText: /kategori/i })).toContainText(letter === "#" ? "angka & simbol" : `huruf ${letter}`, { ignoreCase: true });
    const cards = page.locator("[data-category-card]");
    await expect(cards).toHaveCount(Math.min(expected.length, 24));
    const shown = await cards.evaluateAll((links) => links.map((link) => link.getAttribute("data-category-card") ?? ""));
    expect(shown.every((slug) => expected.includes(slug))).toBe(true);

    // Huruf tanpa kategori: tidak bisa diklik.
    if (empty) {
      await expect(index.locator(`[data-letter="${empty}"]`)).toHaveAttribute("aria-disabled", "true");
      await expect(index.getByRole("link", { name: new RegExp(`^Huruf ${empty},`) })).toHaveCount(0);
    }

    // Mengetik menghapus huruf; "Semua" kembali aktif.
    await page.getByRole("searchbox", { name: "Cari kategori" }).fill(all.data[0].name);
    await page.waitForURL((url) => url.searchParams.has("q") && !url.searchParams.has("huruf"));
    await expect(index.getByRole("link", { name: "Semua" })).toHaveAttribute("aria-current", "true");

    // Huruf di URL tanpa JS + canonical ke /pelatihan.
    await page.goto(`/pelatihan?huruf=${encodeURIComponent(letter)}`);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/pelatihan$/);
  });

  test("grid kategori: paginasi bernomor di URL, judul & canonical per halaman, halaman di luar batas", async ({ page }) => {
    // Membuat & menghapus kategori/pelatihan uji (masing-masing memicu revalidate) butuh waktu.
    test.setTimeout(120_000);
    await loginViaApi(page.request);
    const readMeta = async () =>
      ((await (await page.request.get("/api/public/categories?page=1")).json()) as { meta: { total: number; totalPages: number } }).meta;
    // Database e2e bisa < 25 kategori publik: tambah kategori uji sementara, masing-masing dengan satu
    // pelatihan tayang (satu pelatihan hanya boleh satu kategori).
    const extraCategoryIds: string[] = [];
    const extraTrainings: CreatedTraining[] = [];
    const initial = await readMeta();
    const missing = Math.max(0, 25 - initial.total);
    try {
      for (let index = 0; index < missing; index += 1) {
        const response = await page.request.post("/api/admin/categories", {
          headers: { Origin: ORIGIN },
          data: { name: `[UJI] Grid ${runId()} ${index}` },
        });
        expect(response.status(), await response.text()).toBe(201);
        const categoryId = ((await response.json()) as { data: { id: string } }).data.id;
        extraCategoryIds.push(categoryId);
        extraTrainings.push(await createTraining(page.request, { title: `[UJI] Isi grid ${runId()} ${index}`, categoryIds: [categoryId], status: "PUBLISHED" }));
      }
      const meta = await readMeta();
      expect(meta.totalPages).toBeGreaterThanOrEqual(2);
      const pages = page.getByRole("navigation", { name: "Halaman" });
      await expect
        .poll(async () => {
          await page.goto("/pelatihan");
          return pages.getByRole("link", { name: "Berikutnya" }).count();
        })
        .toBe(1);
      await expect(page.getByText(`Halaman 1 dari ${meta.totalPages} / 1-24 dari ${meta.total.toLocaleString("id-ID")}`)).toBeVisible();
      await expect(pages.getByRole("link", { name: "Halaman 1" })).toHaveAttribute("aria-current", "page");
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/pelatihan$/);

      await pages.getByRole("link", { name: "Berikutnya" }).click();
      await page.waitForURL(/\/pelatihan\?page=2$/);
      await expect(pages.getByRole("link", { name: "Halaman 2" })).toHaveAttribute("aria-current", "page");
      await expect(page).toHaveTitle(/^Pelatihan, halaman 2/);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/pelatihan\?page=2$/);
      const lists = await page.evaluate(() =>
        [...document.querySelectorAll('script[type="application/ld+json"]')]
          .map((script) => JSON.parse(script.textContent ?? "{}") as { "@type"?: string; itemListElement?: { position: number; url: string }[] })
          .filter((data) => data["@type"] === "ItemList"),
      );
      expect(lists).toHaveLength(1);
      const ld = { itemListElement: lists[0].itemListElement ?? [] };
      expect(ld.itemListElement[0].position).toBe(25);
      expect(ld.itemListElement[0].url).toMatch(/^\/pelatihan\/kategori\//);

      // Di luar batas: dirender sebagai halaman terakhir.
      await page.goto("/pelatihan?page=999");
      await expect(pages.getByRole("link", { name: `Halaman ${meta.totalPages}` })).toHaveAttribute("aria-current", "page");
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", new RegExp(`\\?page=${meta.totalPages}$`));
    } finally {
      for (const training of extraTrainings) await deleteTraining(page.request, training.id);
      for (const categoryId of extraCategoryIds) await page.request.delete(`/api/admin/categories/${categoryId}`, { headers: { Origin: ORIGIN } });
    }
  });

  test("URL katalog lama: ?metode=/?tipe=/?sort=/?urut=/?hal= -> 308 ke /pelatihan (q & page tetap)", async ({ request }) => {
    const location = async (query: string) => {
      const response = await request.get(`/pelatihan?${query}`, { maxRedirects: 0 });
      expect(response.status(), query).toBe(308);
      const url = new URL(response.headers()["location"] ?? "", "http://x");
      return `${url.pathname}${url.search}`;
    };
    expect(await location("metode=online")).toBe("/pelatihan");
    expect(await location("tipe=public&q=pajak&page=2")).toBe("/pelatihan?q=pajak&page=2");
    expect(await location("sort=az")).toBe("/pelatihan");
    expect(await location("urut=terbaru&hal=3")).toBe("/pelatihan?page=3");
    // Tanpa parameter lama: tidak dialihkan.
    expect((await request.get("/pelatihan?page=2", { maxRedirects: 0 })).status()).toBe(200);
  });

  test("slug yang tidak ada mengembalikan HTTP 404 sungguhan", async ({ request }) => {
    const missing = `tidak-ada-${runId()}`;
    expect((await request.get(`/pelatihan/${missing}`)).status()).toBe(404);
    // Permintaan kedua (dari cache) tetap 404.
    expect((await request.get(`/pelatihan/${missing}`)).status()).toBe(404);
    expect((await request.get(`/pelatihan/kategori/${missing}`)).status()).toBe(404);
  });
});
