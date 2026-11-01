import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { loginViaApi, ORIGIN, runId } from "./helpers";

// Screenshot halaman artikel (publik 360/768/1280 px, admin 1280 px) di server e2e (training_e2e).
// Hanya jalan kalau ARTICLE_SCREENS_OUT diisi, mis.:
//   ARTICLE_SCREENS_OUT=test-results/article-screens npx playwright test e2e/article-screens.spec.ts
// Data dibuat lewat API dengan awalan [UJI]; database e2e di-reset tiap run.

const OUT = process.env.ARTICLE_SCREENS_OUT ?? "";
const WIDTHS = [360, 768, 1280];
const HEADERS = { Origin: ORIGIN };

const paragraph = (text: string) => ({ type: "paragraph", content: [{ type: "text", text }] });

test.describe("screenshot artikel @manual", () => {
  test.skip(!OUT, "Butuh ARTICLE_SCREENS_OUT.");
  test.setTimeout(240_000);

  test("daftar, detail, dan admin artikel", async ({ page }) => {
    mkdirSync(OUT, { recursive: true });
    await loginViaApi(page.request);
    const id = runId();

    const categories: { id: string; slug: string }[] = [];
    for (const name of [`[UJI] Teknologi ${id}`, `[UJI] Berita ${id}`]) {
      const response = await page.request.post("/api/admin/article-categories", { headers: HEADERS, data: { name } });
      categories.push(((await response.json()) as { data: { id: string; slug: string } }).data);
    }

    const image = readFileSync(path.join(__dirname, "fixtures", "sample.png"));
    const upload = await page.request.post("/api/admin/media", {
      headers: HEADERS,
      multipart: { files: { name: "artikel.png", mimeType: "image/png", buffer: image }, folder: "uji" },
    });
    const coverId = ((await upload.json()) as { data: { created: { id: string }[] } }).data.created[0].id;
    await page.request.patch(`/api/admin/media/${coverId}`, { headers: HEADERS, data: { alt: "Sampul uji" } });

    const slugs: string[] = [];
    for (let index = 0; index < 5; index += 1) {
      const response = await page.request.post("/api/admin/articles", {
        headers: HEADERS,
        data: {
          title: `[UJI] Artikel ${index + 1} tentang operasi drone di lapangan ${id}`,
          authorName: "Tim Media",
          sourceName: index === 0 ? "Sumber uji" : null,
          sourceUrl: index === 0 ? "https://example.com/berita" : null,
          categoryId: categories[index % 2].id,
          coverId: index % 3 === 2 ? null : coverId,
          excerpt: "Ringkasan uji dua sampai tiga kalimat untuk kartu artikel. Kalimat kedua sebagai pelengkap.",
          body: {
            type: "doc",
            content: [
              paragraph("Paragraf pembuka artikel uji."),
              { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Subjudul" }] },
              paragraph("Paragraf kedua dengan isi yang lebih panjang untuk melihat lebar baca di halaman detail."),
            ],
          },
          status: "PUBLISHED",
          publishedAt: new Date(Date.now() - index * 60_000).toISOString(),
        },
      });
      expect(response.status(), await response.text()).toBe(201);
      slugs.push(((await response.json()) as { data: { slug: string } }).data.slug);
    }
    // Satu terjadwal untuk kalender admin.
    await page.request.post("/api/admin/articles", {
      headers: HEADERS,
      data: {
        title: `[UJI] Terjadwal ${id}`,
        authorName: "Tim Media",
        categoryId: categories[0].id,
        body: { type: "doc", content: [paragraph("Isi.")] },
        status: "PUBLISHED",
        publishedAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      },
    });

    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      for (const [name, url] of [
        ["artikel", "/artikel"],
        ["artikel-detail", `/artikel/${slugs[0]}`],
      ] as const) {
        await expect(async () => {
          const response = await page.goto(url, { waitUntil: "networkidle" });
          expect(response?.status()).toBe(200);
          await expect(page.getByText(`[UJI] Artikel 1 tentang operasi drone di lapangan ${id}`).first()).toBeVisible({
            timeout: 2_000,
          });
        }).toPass({ timeout: 30_000 });
        await page.screenshot({ path: path.join(OUT, `${name}-${width}-layar1.png`) });
        // Gulir sampai bawah supaya semua reveal selesai, lalu halaman penuh.
        await page.evaluate(async () => {
          for (let y = 0; y < document.body.scrollHeight; y += 400) {
            window.scrollTo(0, y);
            await new Promise((resolve) => setTimeout(resolve, 60));
          }
        });
        await page.waitForTimeout(800);
        await page.screenshot({ path: path.join(OUT, `${name}-${width}-penuh.png`), fullPage: true });
      }
    }

    // Section beranda "Artikel terbaru" (screenshot elemen section saja).
    const heading = `[UJI] Berita & artikel terbaru ${id}`;
    const section = await page.request.post("/api/admin/home-sections", {
      headers: HEADERS,
      data: {
        type: "LATEST_ARTICLES",
        content: { eyebrow: "Informasi", heading, limit: 3, cta: { label: "Lihat semua artikel", href: "/artikel" } },
      },
    });
    const sectionId = ((await section.json()) as { data: { id: string } }).data.id;
    try {
      for (const width of [360, 1280]) {
        await page.setViewportSize({ width, height: 900 });
        await expect(async () => {
          await page.goto("/", { waitUntil: "networkidle" });
          await expect(page.getByRole("heading", { level: 2, name: heading })).toBeVisible({ timeout: 2_000 });
        }).toPass({ timeout: 30_000 });
        const region = page.locator("section", { has: page.getByRole("heading", { level: 2, name: heading }) });
        await region.scrollIntoViewIfNeeded();
        await page.waitForTimeout(1200);
        await region.screenshot({ path: path.join(OUT, `beranda-artikel-${width}.png`) });
      }
    } finally {
      await page.request.delete(`/api/admin/home-sections/${sectionId}`, { headers: HEADERS });
    }

    await page.setViewportSize({ width: 1280, height: 900 });
    for (const [name, url] of [
      ["admin-daftar", "/admin/articles"],
      ["admin-kalender", "/admin/articles?tab=kalender"],
      ["admin-tulis", "/admin/articles/new"],
    ] as const) {
      await page.goto(url, { waitUntil: "networkidle" });
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(OUT, `${name}-1280.png`), fullPage: true });
    }
  });
});
