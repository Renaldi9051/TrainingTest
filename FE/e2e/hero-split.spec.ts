import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { loginViaApi, ORIGIN, photoLikeJpeg, runId } from "./helpers";

// Hero layout split (DESIGN.md 8.1): teks 5 kolom, foto 7 kolom. Headline tidak boleh keluar dari
// kolom teks (kata terpanjang seed, 1024/1280/1440 px); foto 3:2 sejajar tengah di desktop, 16:9 di
// bawah teks di mobile; titik fokus yang disimpan editor slide admin sampai ke object-position.
// Data uji hanya di training_e2e; isi hero dikembalikan di akhir.
// Opsional: HERO_SPLIT_OUT=<folder> (screenshot), HERO_SPLIT_PHOTOS=<foto1,foto2,foto3> (foto 16:9).

const OUT = process.env.HERO_SPLIT_OUT;
const PHOTOS = process.env.HERO_SPLIT_PHOTOS?.split(",").map((value) => value.trim()).filter(Boolean) ?? [];
const HEADERS = { Origin: ORIGIN };

type Section = { id: string; type: string; content: Record<string, unknown> | null };
type Slide = { mediaId: string; focalX: number; focalY: number };

let heroId = "";
let original: Record<string, unknown> | null = null;
const mediaIds: string[] = [];

const textColumn = (page: Page) => page.locator("section.hero-stage > div").first();
const photoBox = (page: Page) => page.locator("section.hero-stage > div:nth-child(2) > div.relative").first();
const activeImage = (page: Page) => page.locator(".hero-slide[data-state=active] img");

async function heroSlides(request: APIRequestContext): Promise<Slide[]> {
  const sections = ((await (await request.get("/api/admin/home-sections")).json()) as { data: Section[] }).data;
  return (sections.find((section) => section.id === heroId)?.content?.slides as Slide[] | undefined) ?? [];
}

test.describe.configure({ mode: "serial" });

test.describe("hero split", () => {
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ baseURL: ORIGIN });
    const request = context.request;
    await loginViaApi(request);
    const id = runId();
    const sections = ((await (await request.get("/api/admin/home-sections")).json()) as { data: Section[] }).data;
    let hero = sections.find((section) => section.type === "HERO");
    if (!hero) {
      const created = await request.post("/api/admin/home-sections", {
        headers: HEADERS,
        data: { type: "HERO", content: { headline: "Tambah pengetahuan, tingkatkan kemampuan" } },
      });
      hero = ((await created.json()) as { data: Section }).data;
    }
    heroId = hero.id;
    original = hero.content;

    for (let index = 0; index < 3; index += 1) {
      const file = PHOTOS[index]
        ? { buffer: readFileSync(PHOTOS[index]), mimeType: PHOTOS[index].endsWith(".webp") ? "image/webp" : "image/jpeg" }
        : await photoLikeJpeg(browser, { seed: 41 + index * 13 });
      const response = await request.post("/api/admin/media", {
        headers: HEADERS,
        multipart: { files: { name: `[UJI]-split-${index + 1}-${id}.jpg`, mimeType: file.mimeType, buffer: file.buffer }, folder: "uji" },
      });
      expect(response.status(), await response.text()).toBe(201);
      const mediaId = ((await response.json()) as { data: { created: { id: string }[] } }).data.created[0].id;
      await request.patch(`/api/admin/media/${mediaId}`, { headers: HEADERS, data: { alt: `[UJI] Foto split ${index + 1}` } });
      mediaIds.push(mediaId);
    }
    // Headline & kata kunci seed (BE/prisma/seed-home-copy.ts): kata terpanjang "pengetahuan,".
    const response = await request.patch(`/api/admin/home-sections/${heroId}`, {
      headers: HEADERS,
      data: {
        visible: true,
        content: {
          ...(original ?? {}),
          eyebrow: "Training provider",
          headline: "Tambah pengetahuan, tingkatkan kemampuan",
          rotatingWords: ["terbang", "berkarya", "berbisnis"],
          subheadline:
            "Pelatihan publik dan in-house untuk perusahaan dan instansi, dari keuangan, SDM, dan manajemen sampai K3, pertambangan, dan migas, dipandu praktisi berpengalaman.",
          showSearch: true,
          layout: "split",
          photoStyle: "color",
          showViewfinder: true,
          showBadge: false,
          decor: true,
          slides: mediaIds.map((mediaId, index) => ({
            mediaId,
            alt: "",
            caption: `[UJI] Slide ${index + 1}`,
            href: "",
            hudLabel: "",
            focalX: index === 0 ? 20 : 50,
            focalY: index === 0 ? 70 : 50,
          })),
        },
      },
    });
    expect(response.status(), await response.text()).toBe(200);
    await context.close();
  });

  test.afterAll(async ({ browser }) => {
    const context = await browser.newContext({ baseURL: ORIGIN });
    await loginViaApi(context.request);
    if (heroId && original) await context.request.patch(`/api/admin/home-sections/${heroId}`, { headers: HEADERS, data: { content: original } });
    for (const id of mediaIds) await context.request.delete(`/api/admin/media/${id}`, { headers: HEADERS });
    await context.close();
  });

  test("headline dan teks lain tidak melewati kolom teks di 1024, 1280, 1440 px", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const width of [1024, 1280, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect.poll(() => activeImage(page).evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
      if (OUT) {
        mkdirSync(OUT, { recursive: true });
        await page.screenshot({ path: path.join(OUT, `split-${width}.png`) });
      }
      // Setiap baris/kata (Range per text node, termasuk semua kata kunci RotatingWord) harus berada di
      // dalam kolom teks, dan kolom teks tidak boleh menimpa kolom foto.
      const overflow = await textColumn(page).evaluate((column) => {
        const box = column.getBoundingClientRect();
        const photo = column.nextElementSibling?.getBoundingClientRect();
        const issues: string[] = [];
        const walker = document.createTreeWalker(column, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          // Teks khusus pembaca layar (.sr-only) tidak tampil.
          if (!node.textContent?.trim() || node.parentElement?.closest(".sr-only")) continue;
          const range = document.createRange();
          range.selectNodeContents(node);
          for (const rect of Array.from(range.getClientRects())) {
            if (rect.width === 0) continue;
            if (rect.right > box.right + 0.5 || rect.left < box.left - 0.5) issues.push(`"${node.textContent.trim()}" ${Math.round(rect.left)}-${Math.round(rect.right)} di luar ${Math.round(box.left)}-${Math.round(box.right)}`);
          }
        }
        if (photo && box.right > photo.left + 0.5) issues.push(`kolom teks (${Math.round(box.right)}) menimpa foto (${Math.round(photo.left)})`);
        return issues;
      });
      expect.soft(overflow, `${width}px`).toEqual([]);
    }
  });

  test("foto 3:2 sejajar tengah di desktop, 16:9 di bawah teks di mobile", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const width of [1024, 1280, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");
      const photo = await photoBox(page).boundingBox();
      const text = await textColumn(page).boundingBox();
      expect(photo && text).toBeTruthy();
      if (!photo || !text) continue;
      expect(photo.width / photo.height, `${width}px rasio`).toBeCloseTo(3 / 2, 1);
      // Kolom foto (foto + indikator) sejajar tengah dengan kolom teks.
      const photoColumn = await photoBox(page).locator("..").boundingBox();
      if (photoColumn) expect(Math.abs(photoColumn.y + photoColumn.height / 2 - (text.y + text.height / 2)), `${width}px tengah`).toBeLessThan(2);
    }
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto("/");
    const photo = await photoBox(page).boundingBox();
    const text = await textColumn(page).boundingBox();
    expect(photo && text).toBeTruthy();
    if (!photo || !text) return;
    expect(photo.width / photo.height, "360px rasio").toBeCloseTo(16 / 9, 1);
    expect(photo.y, "foto di bawah teks").toBeGreaterThanOrEqual(text.y + text.height);
  });

  test("titik fokus dari editor slide tersimpan dan dipakai sebagai object-position", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await expect(activeImage(page)).toHaveCSS("object-position", "20% 70%");

    await loginViaApi(page.request);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`/admin/home/${heroId}`);
    await page.getByRole("button", { name: "Atur slide 01" }).click();
    await expect(page.getByRole("spinbutton", { name: "Horizontal (%)" })).toHaveValue("20");
    await page.getByRole("spinbutton", { name: "Horizontal (%)" }).fill("35");
    await page.getByRole("button", { name: "Simpan", exact: true }).click();
    await expect.poll(async () => (await heroSlides(page.request))[0]?.focalX).toBe(35);
    expect((await heroSlides(page.request))[0]?.focalY).toBe(70);

    // Halaman publik memakai nilai baru setelah revalidate (< 5 detik).
    await expect
      .poll(
        async () => {
          await page.goto("/");
          return activeImage(page).evaluate((image) => getComputedStyle(image).objectPosition);
        },
        { timeout: 15_000 },
      )
      .toBe("35% 70%");
  });
});
