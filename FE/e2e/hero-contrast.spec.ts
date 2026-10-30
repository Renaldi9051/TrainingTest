import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { loginViaApi, ORIGIN, photoLikeJpeg, runId } from "./helpers";

// Kontras teks hero fullbleed di atas foto terang (DESIGN.md 2 & 8.1). Per slide, di 1280 dan 360 px:
// teks yang diukur disembunyikan, lalu piksel paling terang di belakang tiap teks (foto + overlay +
// grain) dibandingkan dengan warna teksnya (termasuk alpha). Target: headline, subjudul, dan menu
// header >= 4,5:1; eyebrow dilaporkan. Data uji hanya di training_e2e; isi hero dikembalikan di akhir.
//   HERO_CONTRAST_OUT=<folder> [HERO_CONTRAST_PHOTOS=<foto1,foto2,foto3>] npx playwright test e2e/hero-contrast.spec.ts
// Tanpa HERO_CONTRAST_PHOTOS dipakai 3 foto buatan bernuansa ruang kelas terang (jendela, layar putih).

const OUT = process.env.HERO_CONTRAST_OUT;
const PHOTOS = process.env.HERO_CONTRAST_PHOTOS?.split(",").map((value) => value.trim()).filter(Boolean) ?? [];
const HEADERS = { Origin: ORIGIN };
const TARGET = 4.5;

type Section = { id: string; type: string; content: Record<string, unknown> | null };
type Measure = { name: string; selector: string; target: number | null };

const MEASURES: Measure[] = [
  { name: "headline", selector: "section[data-header-over] h1", target: TARGET },
  { name: "subjudul", selector: "section[data-header-over] h1 ~ p", target: TARGET },
  { name: "eyebrow", selector: "section[data-header-over] p:has(+ h1)", target: null },
  // Teks header di atas foto (link menu, tombol submenu/indeks, Cari, merek, tombol menu mobile);
  // tombol CTA header punya latar sendiri.
  {
    name: "menu header",
    selector: "header.site-header :is(a, button):not(.site-header-cta, .site-header-cta *)",
    target: TARGET,
  },
];

let heroId = "";
let original: Record<string, unknown> | null = null;
const mediaIds: string[] = [];

function mimeOf(file: string): string {
  const extension = path.extname(file).toLowerCase();
  return extension === ".png" ? "image/png" : extension === ".webp" ? "image/webp" : "image/jpeg";
}

async function upload(request: APIRequestContext, name: string, file: { buffer: Buffer; mimeType: string }) {
  const response = await request.post("/api/admin/media", {
    headers: HEADERS,
    multipart: { files: { name, mimeType: file.mimeType, buffer: file.buffer }, folder: "uji" },
  });
  expect(response.status(), await response.text()).toBe(201);
  const id = ((await response.json()) as { data: { created: { id: string }[] } }).data.created[0].id;
  const alt = await request.patch(`/api/admin/media/${id}`, { headers: HEADERS, data: { alt: `[UJI] Foto kontras ${name}` } });
  expect(alt.status()).toBe(200);
  return id;
}

// Kontras WCAG 2.1 antara warna teks (rgba, dikomposit di atas piksel) dan piksel latar.
function contrast(text: [number, number, number, number], background: [number, number, number]): number {
  const [r, g, b, a] = text;
  const mixed = [r, g, b].map((channel, index) => channel * a + background[index] * (1 - a));
  const luminance = (rgb: number[]) =>
    rgb
      .map((value) => value / 255)
      .map((value) => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4))
      .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
  const [high, low] = [luminance(mixed), luminance(background)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
}

type Box = { x: number; y: number; right: number; bottom: number };

// Untuk tiap ukuran: kotak setiap baris/kata teks (Range.getClientRects per text node, dengan warna
// elemen induknya; ikon tanpa teks memakai kotak ikonnya), lalu piksel paling terang (luminans) di
// dalam kotak itu pada screenshot dengan teks yang diukur dan tanda dekoratif (sudut/crosshair
// Viewfinder, BrandMark) disembunyikan. Kontras elemen = kontras terendah di antara kotaknya.
async function measure(page: Page, hiddenShot: string) {
  const targets = await page.evaluate((measures) => {
    // Warna terhitung bisa berformat rgb(), color(srgb ...), atau oklab(); dinormalisasi lewat 1 piksel
    // canvas menjadi RGBA 0-255 (alpha 0-1).
    const canvas = new OffscreenCanvas(1, 1);
    const context = canvas.getContext("2d", { willReadFrequently: true });
    const parse = (value: string): [number, number, number, number] => {
      if (!context) return [0, 0, 0, 1];
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = value;
      context.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
      return [r, g, b, a / 255];
    };
    const clip = (rect: DOMRect) => ({ x: Math.max(0, rect.left), y: Math.max(0, rect.top), right: Math.min(innerWidth, rect.right), bottom: Math.min(innerHeight, rect.bottom) });
    const usable = (rect: DOMRect) => rect.width > 2 && rect.height > 2 && rect.bottom > 0 && rect.top < innerHeight;
    return measures.flatMap(({ name, selector }) =>
      Array.from(document.querySelectorAll<HTMLElement>(selector))
        .filter((element) => {
          const box = element.getBoundingClientRect();
          return usable(box) && getComputedStyle(element).visibility !== "hidden";
        })
        .map((element) => {
          const parts: { color: [number, number, number, number]; box: { x: number; y: number; right: number; bottom: number } }[] = [];
          const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
          for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            if (!node.textContent?.trim() || !node.parentElement) continue;
            const color = parse(getComputedStyle(node.parentElement).color);
            const range = document.createRange();
            range.selectNodeContents(node);
            for (const rect of Array.from(range.getClientRects()).filter(usable)) parts.push({ color, box: clip(rect) });
          }
          if (parts.length === 0) {
            for (const icon of Array.from(element.querySelectorAll("svg"))) {
              const rect = icon.getBoundingClientRect();
              if (usable(rect)) parts.push({ color: parse(getComputedStyle(element).color), box: clip(rect) });
            }
          }
          element.setAttribute("data-measure-hide", "");
          return { name, label: (element.textContent?.trim() || element.getAttribute("aria-label") || "").slice(0, 32), parts };
        })
        .filter((target) => target.parts.length > 0),
    );
  }, MEASURES);
  const hide = await page.addStyleTag({
    content: [
      "[data-measure-hide], [data-measure-hide] * { color: transparent !important; -webkit-text-fill-color: transparent !important; }",
      "[data-measure-hide] svg, [data-measure-hide] [aria-hidden], [data-active-indicator] { visibility: hidden !important; }",
      // Sudut & crosshair Viewfinder di atas foto: tanda dekoratif, bukan latar teks.
      ".hero-stage div[aria-hidden][data-surface] { visibility: hidden !important; }",
    ].join(" "),
  });
  await page.waitForTimeout(100);
  const png = (await page.screenshot({ path: hiddenShot })).toString("base64");
  const boxes: Box[] = targets.flatMap((target) => target.parts.map((part) => part.box));
  const brightest = await page.evaluate(
    async ({ png, boxes }) => {
      const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${png}`)).blob());
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const context = canvas.getContext("2d");
      if (!context) return [];
      context.drawImage(bitmap, 0, 0);
      const scale = bitmap.width / innerWidth;
      return boxes.map((box) => {
        const x = Math.floor(box.x * scale);
        const y = Math.floor(box.y * scale);
        const width = Math.max(1, Math.ceil((box.right - box.x) * scale));
        const height = Math.max(1, Math.ceil((box.bottom - box.y) * scale));
        const data = context.getImageData(x, y, width, height).data;
        let best: [number, number, number] = [0, 0, 0];
        let bestLuminance = -1;
        for (let i = 0; i < data.length; i += 4) {
          const luminance = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
          if (luminance > bestLuminance) {
            bestLuminance = luminance;
            best = [data[i], data[i + 1], data[i + 2]];
          }
        }
        return best;
      });
    },
    { png, boxes },
  );
  await hide.evaluate((style) => style.parentNode?.removeChild(style));
  await page.evaluate(() => document.querySelectorAll("[data-measure-hide]").forEach((element) => element.removeAttribute("data-measure-hide")));
  let index = 0;
  return targets.map((target) => {
    let worst = { ratio: Infinity, background: [0, 0, 0] as [number, number, number] };
    for (const part of target.parts) {
      const background = brightest[index];
      index += 1;
      const ratio = contrast(part.color, background);
      if (ratio < worst.ratio) worst = { ratio, background };
    }
    return { name: target.name, label: target.label, background: worst.background, ratio: Math.round(worst.ratio * 100) / 100 };
  });
}

test.describe.configure({ mode: "serial" });

test.describe("kontras teks hero fullbleed di atas foto terang @manual", () => {
  test.skip(!OUT, "Butuh HERO_CONTRAST_OUT.");

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
        data: { type: "HERO", content: { headline: "[UJI] Belajar dari praktisinya" } },
      });
      hero = ((await created.json()) as { data: Section }).data;
    }
    heroId = hero.id;
    original = hero.content;

    // Foto buatan: dinding terang, jendela putih di kiri, layar presentasi putih di tengah.
    const synthetic = [
      { from: "#f4efe6", to: "#ffffff", seed: 5 },
      { from: "#ffffff", to: "#dcd6cb", seed: 17 },
      { from: "#e8e2d6", to: "#fbfaf7", seed: 29 },
    ];
    for (let index = 0; index < 3; index += 1) {
      const file = PHOTOS[index]
        ? { buffer: readFileSync(PHOTOS[index]), mimeType: mimeOf(PHOTOS[index]) }
        : await photoLikeJpeg(browser, synthetic[index]);
      mediaIds.push(await upload(request, `[UJI]-kontras-${index + 1}-${id}`, file));
    }
    const response = await request.patch(`/api/admin/home-sections/${heroId}`, {
      headers: HEADERS,
      data: {
        visible: true,
        content: {
          ...(original ?? {}),
          eyebrow: "Training provider",
          headline: "[UJI] Tambah pengetahuan, tingkatkan kemampuan",
          rotatingWords: ["memimpin"],
          subheadline: "Pelatihan publik dan in-house untuk perusahaan dan instansi, dipandu praktisi berpengalaman.",
          layout: "fullbleed",
          photoStyle: "color",
          showViewfinder: true,
          showBadge: false,
          decor: true,
          slides: mediaIds.map((mediaId, index) => ({ mediaId, alt: "", caption: `[UJI] Slide ${index + 1}`, href: "", hudLabel: "", focalX: 50, focalY: 50 })),
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

  test("ukur kontras di 3 slide, 1280 dan 360 px", async ({ page }) => {
    test.setTimeout(180_000);
    mkdirSync(OUT ?? "", { recursive: true });
    // Reduced motion: tanpa autoplay/Ken Burns, slide pindah langsung lewat segmen.
    await page.emulateMedia({ reducedMotion: "reduce" });
    const rows: { width: number; slide: number; name: string; label: string; background: number[]; ratio: number }[] = [];
    for (const width of [1280, 360]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/");
      // HERO_CONTRAST_STRENGTH: kekuatan scrim (lapisan 1) untuk semua slide, mis. 1 untuk batas atas slider.
      if (process.env.HERO_CONTRAST_STRENGTH) {
        await page.addStyleTag({ content: `.hero-scrim { --overlay-strength: ${Number(process.env.HERO_CONTRAST_STRENGTH)}; }` });
      }
      for (let slide = 0; slide < 3; slide += 1) {
        await page.getByRole("group", { name: "Pilih slide" }).getByRole("button").nth(slide).click();
        // Klik segmen menggulir indikator ke layar; ukur di posisi awal halaman.
        await page.mouse.move(0, 799);
        await page.evaluate(() => {
          (document.activeElement as HTMLElement | null)?.blur();
          window.scrollTo(0, 0);
        });
        const image = page.locator(".hero-slide[data-state=active] img");
        await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0)).toBe(true);
        await page.waitForTimeout(400);
        await page.screenshot({ path: path.join(OUT ?? "", `hero-${width}-slide${slide + 1}.png`) });
        for (const row of await measure(page, path.join(OUT ?? "", `hero-${width}-slide${slide + 1}-tanpa-teks.png`))) rows.push({ width, slide: slide + 1, ...row });
      }
    }
    writeFileSync(path.join(OUT ?? "", "kontras.json"), JSON.stringify(rows, null, 2));
    // Ringkasan: kontras terendah per elemen, per lebar, per slide.
    for (const width of [1280, 360]) {
      for (const { name, target } of MEASURES) {
        const values = [1, 2, 3].map((slide) => Math.min(...rows.filter((row) => row.width === width && row.slide === slide && row.name === name).map((row) => row.ratio)));
        console.log(`${width}px ${name.padEnd(12)} ${values.map((value) => value.toFixed(2)).join(" / ")}`);
        if (target) for (const value of values) expect.soft(value, `${width}px ${name}`).toBeGreaterThanOrEqual(target);
      }
    }
  });
});
