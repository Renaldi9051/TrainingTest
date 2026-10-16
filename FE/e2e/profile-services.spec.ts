import { mkdirSync } from "node:fs";
import path from "node:path";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { createTraining, deleteTraining, firstCategory, loginViaApi, ORIGIN, photoLikeJpeg, runId, type CreatedTraining } from "./helpers";

// Profil, portofolio, layanan redesign v0.2 (fase 5): field baru layanan (tagline, benefit, FAQ,
// pelatihan terkait manual), jenis kegiatan portofolio (chip ?jenis= + galeri), kepala halaman dari
// Pengaturan (kosong = label lama), alur kerja sama, area marketing. Data uji hanya di training_e2e:
// foto JPEG buatan generator. Pengaturan dikembalikan ke nilai semula di akhir.
// Screenshot 360/768/1280 (opsional): SCREENS_OUT=<folder> npx playwright test e2e/profile-services.spec.ts

const HEADERS = { Origin: ORIGIN };

type Created = { id: string; slug?: string };

async function send<T = Created>(request: APIRequestContext, method: "POST" | "PATCH" | "PUT", url: string, data: unknown): Promise<T> {
  const response = await request.fetch(`/api${url}`, { method, headers: HEADERS, data });
  expect(response.status(), await response.text()).toBeLessThan(300);
  return ((await response.json()) as { data: T }).data;
}

async function uploadPhoto(request: APIRequestContext, name: string, alt: string, file: { buffer: Buffer; mimeType: string }) {
  const response = await request.post("/api/admin/media", {
    headers: HEADERS,
    multipart: { files: { name, mimeType: file.mimeType, buffer: file.buffer }, folder: "uji" },
  });
  expect(response.status(), await response.text()).toBe(201);
  const id = ((await response.json()) as { data: { created: { id: string }[] } }).data.created[0].id;
  await send(request, "PATCH", `/admin/media/${id}`, { alt });
  return id;
}

async function headingIssues(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const visible = (element: Element) => getComputedStyle(element).display !== "none";
    const levels = [...document.querySelectorAll("main h1, main h2, main h3, main h4")].filter(visible).map((element) => Number(element.tagName[1]));
    const issues: string[] = [];
    if (levels.filter((level) => level === 1).length !== 1) issues.push(`jumlah h1 = ${levels.filter((level) => level === 1).length}`);
    levels.forEach((level, index) => {
      if (index > 0 && level > levels[index - 1] + 1) issues.push(`h${levels[index - 1]} -> h${level}`);
    });
    return issues;
  });
}

test.describe.configure({ mode: "serial" });

test.describe("profil, portofolio, layanan v0.2", () => {
  const id = runId();
  const trainings: CreatedTraining[] = [];
  const services: Created[] = [];
  const portfolio: Created[] = [];
  let marketingId = "";
  let originalSettings: { headers: unknown; process: unknown } | null = null;
  let service: Created & { slug: string };
  let plain: Created & { slug: string };

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ baseURL: ORIGIN });
    const request = context.request;
    await loginViaApi(request);
    const settings = (await (await request.get("/api/admin/settings")).json()) as { data: { values: Record<string, unknown> } };
    originalSettings = { headers: settings.data.values["page.headers"], process: settings.data.values["services.process"] };

    const category = await firstCategory(request);
    const related = await createTraining(request, { title: `[UJI] Terkait ${id}`, categoryIds: [category.id], status: "PUBLISHED" });
    const draft = await createTraining(request, { title: `[UJI] Draf terkait ${id}`, categoryIds: [category.id], status: "DRAFT" });
    trainings.push(related, draft);

    service = (await send(request, "POST", "/admin/services", {
      title: `[UJI] Layanan lengkap ${id}`,
      tagline: "Kelas khusus instansi",
      summary: "Ringkasan layanan uji.",
      status: "PUBLISHED",
      benefits: [
        { icon: null, title: "Materi disesuaikan", description: "Studi kasus dari instansi Anda." },
        { icon: null, title: "Jadwal fleksibel", description: "" },
      ],
      faqs: [{ q: "Berapa minimal peserta?", a: "Sepuluh orang." }],
      trainingSelection: { mode: "manual", ids: [draft.id, related.id] },
    })) as Created & { slug: string };
    plain = (await send(request, "POST", "/admin/services", { title: `[UJI] Layanan polos ${id}`, status: "PUBLISHED" })) as Created & {
      slug: string;
    };
    services.push(service, plain);

    const photos = [
      await uploadPhoto(request, `[UJI]-porto-1-${id}.jpg`, "[UJI] Praktik lapangan", await photoLikeJpeg(browser, { seed: 5 })),
      await uploadPhoto(request, `[UJI]-porto-2-${id}.jpg`, "[UJI] Suasana kelas", await photoLikeJpeg(browser, { from: "#3c5a7a", to: "#d6c3a0", seed: 9 })),
    ];
    portfolio.push(
      await send(request, "POST", "/admin/portfolio", { title: `[UJI] Lapangan ${id}`, activityType: "FIELD", imageIds: photos, description: "Deskripsi kegiatan lapangan." }),
      await send(request, "POST", "/admin/portfolio", { title: `[UJI] Kelas ${id}`, activityType: "CLASSROOM", imageIds: [photos[1]] }),
      await send(request, "POST", "/admin/portfolio", { title: `[UJI] Tanpa jenis ${id}` }),
    );
    marketingId = (await send(request, "POST", "/admin/marketing", { name: `[UJI] Marketing ${id}`, phone: "081200000777", area: "Instansi pemerintah" })).id;
    await context.close();
  });

  test.afterAll(async ({ browser }) => {
    const context = await browser.newContext({ baseURL: ORIGIN });
    const request = context.request;
    await loginViaApi(request);
    if (originalSettings) {
      await send(request, "PUT", "/admin/settings/page.headers", originalSettings.headers);
      await send(request, "PUT", "/admin/settings/services.process", originalSettings.process);
    }
    for (const item of services) await request.delete(`/api/admin/services/${item.id}`, { headers: HEADERS });
    for (const item of portfolio) await request.delete(`/api/admin/portfolio/${item.id}`, { headers: HEADERS });
    if (marketingId) await request.delete(`/api/admin/marketing/${marketingId}`, { headers: HEADERS });
    for (const training of trainings) await deleteTraining(request, training.id);
    await context.close();
  });

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
  });

  test("layanan: kepala halaman kosong = label lama; diisi dari Pengaturan; alur kerja sama tampil kalau ada langkah", async ({ page }) => {
    await page.goto("/layanan");
    await expect(page.getByRole("heading", { level: 1, name: "Layanan", exact: true })).toBeVisible();
    await expect(page.getByText("Langkah 01")).toHaveCount(0);
    const row = page.locator("li", { has: page.getByRole("link", { name: `[UJI] Layanan lengkap ${id}` }) });
    await expect(row.getByText("Kelas khusus instansi")).toBeVisible();

    await loginViaApi(page.request);
    await page.goto("about:blank");
    await send(page.request, "PUT", "/admin/settings/page.headers", {
      ...(originalSettings?.headers as object),
      layanan: { eyebrow: "Kerja sama", heading: `Pilih format ${id}`, lead: "Pengantar uji layanan." },
    });
    await send(page.request, "PUT", "/admin/settings/services.process", {
      eyebrow: "Alur kerja sama",
      heading: "Dari konsultasi sampai sertifikat",
      steps: [{ title: "Konsultasi", description: "Ceritakan kebutuhan tim." }, { title: "Pelaksanaan", description: "" }],
    });
    await expect.poll(async () => (await (await page.request.get("/layanan")).text()).includes(`Pilih format ${id}`), { timeout: 5_000 }).toBe(true);
    await page.goto("/layanan");
    await expect(page.getByRole("heading", { level: 1, name: `Pilih format ${id}` })).toBeVisible();
    await expect(page.getByText("Pengantar uji layanan.")).toBeVisible();
    const process = page.getByRole("region", { name: "Dari konsultasi sampai sertifikat" });
    await expect(process.getByText("Langkah 02")).toBeVisible();
    await expect(process.getByRole("heading", { level: 3, name: "Konsultasi" })).toBeVisible();
    expect(await headingIssues(page)).toEqual([]);
  });

  test("detail layanan: tagline, benefit, pelatihan terkait (draf tersaring), FAQ; layanan tanpa data tanpa bagian kosong", async ({ page }) => {
    await page.goto(`/layanan/${service.slug}`);
    await expect(page.getByRole("heading", { level: 1, name: `[UJI] Layanan lengkap ${id}` })).toBeVisible();
    await expect(page.getByText("Kelas khusus instansi")).toBeVisible();
    const benefits = page.getByRole("region", { name: "Yang Anda dapat" });
    await expect(benefits.getByRole("heading", { level: 3 })).toHaveText(["Materi disesuaikan", "Jadwal fleksibel"]);
    const related = page.getByRole("region", { name: "Pelatihan terkait" });
    await expect(related.getByRole("link", { name: `[UJI] Terkait ${id}` })).toBeVisible();
    await expect(related.getByText(`[UJI] Draf terkait ${id}`)).toHaveCount(0);
    const faq = page.getByRole("region", { name: "Pertanyaan umum" });
    await faq.getByText("Berapa minimal peserta?").click();
    await expect(faq.getByText("Sepuluh orang.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Hubungi kami" }).first()).toHaveAttribute("href", "/kontak");
    expect(await headingIssues(page)).toEqual([]);

    await page.goto(`/layanan/${plain.slug}`);
    await expect(page.getByRole("heading", { level: 1, name: `[UJI] Layanan polos ${id}` })).toBeVisible();
    for (const name of ["Yang Anda dapat", "Pelatihan terkait", "Pertanyaan umum"]) {
      await expect(page.getByRole("region", { name })).toHaveCount(0);
    }
  });

  test("portofolio: chip hanya jenis yang ada, ?jenis= menyaring, galeri lengkap di dialog", async ({ page }) => {
    await page.goto("/profil/portofolio");
    const chips = page.getByRole("group", { name: "Filter jenis kegiatan" }).getByRole("link");
    await expect(chips).toContainText(["Semua", "Lapangan", "Kelas"]);
    await expect(chips.filter({ hasText: "Outbound" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: `[UJI] Tanpa jenis ${id}` })).toBeVisible();

    await chips.filter({ hasText: "Lapangan" }).click();
    await expect(page).toHaveURL(/\/profil\/portofolio\?jenis=lapangan$/);
    await expect(page.getByRole("button", { name: `[UJI] Lapangan ${id}` })).toBeVisible();
    await expect(page.getByRole("button", { name: `[UJI] Kelas ${id}` })).toHaveCount(0);
    await expect(page.getByRole("button", { name: `[UJI] Tanpa jenis ${id}` })).toHaveCount(0);

    const trigger = page.getByRole("button", { name: `[UJI] Lapangan ${id}` });
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: `[UJI] Lapangan ${id}` });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Deskripsi kegiatan lapangan.")).toBeVisible();
    await expect(dialog.getByRole("img")).toHaveCount(2);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
    expect(await headingIssues(page)).toEqual([]);
  });

  test("profil: dua blok daftar berurutan berdampingan, isi blok tidak berubah", async ({ page }) => {
    await page.goto("/profil");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const profile = await (await page.request.get("/api/public/pages/profil")).json();
    const lists = (profile as { data: { blocks: { type: string; heading: string; items: string[] }[] } }).data.blocks.filter((block) => block.type === "LIST");
    for (const list of lists) {
      for (const item of list.items) await expect(page.getByText(item, { exact: true }).first()).toBeVisible();
    }
    expect(await headingIssues(page)).toEqual([]);
  });

  test("marketing: area tersimpan dan ikut di data publik", async ({ request }) => {
    const response = await request.get("/api/public/marketing");
    const contacts = ((await response.json()) as { data: { name: string; area: string | null }[] }).data;
    expect(contacts.find((contact) => contact.name === `[UJI] Marketing ${id}`)?.area).toBe("Instansi pemerintah");
  });

  test("screenshot profil, portofolio, layanan, detail layanan di 360/768/1280", async ({ page }) => {
    const out = process.env.SCREENS_OUT;
    test.skip(!out, "Butuh SCREENS_OUT.");
    test.setTimeout(240_000);
    const dir = out ?? "";
    mkdirSync(dir, { recursive: true });
    const shots: [string, string][] = [
      ["profil", "/profil"],
      ["portofolio", "/profil/portofolio"],
      ["portofolio-filter", "/profil/portofolio?jenis=lapangan"],
      ["layanan", "/layanan"],
      ["layanan-detail", `/layanan/${service.slug}`],
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
