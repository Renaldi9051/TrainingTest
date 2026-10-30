import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { loginViaApi } from "./helpers";

// Palet C hanya untuk halaman publik (app/(public)/palette-c.css, scope [data-site="public"]). Admin
// harus tetap netral: token :root di semua halaman admin sama dengan baseline sebelum palet C
// (fixtures/admin-tokens.json). Token baru yang dideklarasikan stylesheet bersama (mis. variabel
// .site-header) boleh ada, tapi tidak boleh punya nilai di :root admin.
// SNAPSHOT_OUT=<file.json>: juga tulis snapshot lengkap (token + himpunan gaya terhitung semua elemen
// per halaman) untuk dibandingkan sekali jalan dengan snapshot sebelum perubahan.

type Baseline = { pages: string[]; tokens: Record<string, string> };
const baseline = JSON.parse(readFileSync(path.join(__dirname, "fixtures", "admin-tokens.json"), "utf8")) as Baseline;

// Halaman detail: id pertama dari API admin (seed e2e minimal tidak punya semua jenis data).
const DETAIL_SOURCES: [string, string][] = [
  ["/api/admin/categories?pageSize=1", "/admin/categories/"],
  ["/api/admin/trainings?pageSize=1", "/admin/trainings/"],
  ["/api/admin/services?pageSize=1", "/admin/services/"],
  ["/api/admin/pages?pageSize=1", "/admin/pages/"],
  ["/api/admin/portfolio?pageSize=1", "/admin/portfolio/"],
  ["/api/admin/home-sections", "/admin/home/"],
  ["/api/admin/inquiries?pageSize=1", "/admin/inquiries/"],
];
const STYLE_PROPS = [
  "color", "background-color", "border-top-color", "border-right-color", "border-bottom-color", "border-left-color",
  "outline-color", "box-shadow", "filter", "border-radius", "text-decoration-color", "fill", "stroke", "accent-color",
];

async function snapshot(page: Page) {
  return page.evaluate((props) => {
    const names = new Set<string>();
    const walk = (rules: CSSRuleList) => {
      for (const rule of Array.from(rules)) {
        if ("style" in rule && rule.style) {
          const style = (rule as CSSStyleRule).style;
          for (let i = 0; i < style.length; i += 1) if (style[i].startsWith("--")) names.add(style[i]);
        }
        if ("cssRules" in rule && (rule as CSSGroupingRule).cssRules) walk((rule as CSSGroupingRule).cssRules);
      }
    };
    for (const sheet of Array.from(document.styleSheets)) walk(sheet.cssRules);
    const root = getComputedStyle(document.documentElement);
    const tokens: Record<string, string> = {};
    for (const name of [...names].sort()) tokens[name] = root.getPropertyValue(name).trim();
    const combos = new Set<string>();
    for (const element of Array.from(document.querySelectorAll("*"))) {
      const style = getComputedStyle(element);
      combos.add(props.map((prop) => style.getPropertyValue(prop)).join("|"));
    }
    return { tokens, styles: [...combos].sort() };
  }, STYLE_PROPS);
}

test("admin tetap netral: token :root semua halaman admin sama dengan baseline", async ({ page }) => {
  test.setTimeout(600_000);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const out = process.env.SNAPSHOT_OUT;
  const result: Record<string, { tokens: Record<string, string>; styleHash: string; styleCount: number; styles: string[] }> = {};

  const capture = async (url: string) => {
    await page.goto(url);
    await page.waitForLoadState("networkidle");
    // Tunggu skeleton/loading selesai dan hover/fokus netral (gaya stabil). /admin/dev/ui
    // menampilkan contoh skeleton secara permanen.
    if (url !== "/admin/dev/ui") {
      await expect(page.locator("[data-slot=skeleton], .animate-pulse, [aria-busy=true]")).toHaveCount(0, { timeout: 20_000 });
    }
    await page.mouse.move(0, 0);
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.waitForTimeout(500);
    const { tokens, styles } = await snapshot(page);
    const key = url.replace(/[0-9a-f-]{36}/, "[id]");
    for (const [name, value] of Object.entries(baseline.tokens)) {
      expect.soft(tokens[name], `${key} ${name}`).toBe(value);
    }
    for (const name of Object.keys(tokens).filter((name) => !(name in baseline.tokens))) {
      expect.soft(tokens[name], `${key} token baru ${name} tidak boleh bernilai di :root admin`).toBe("");
    }
    result[key] = {
      tokens,
      styleHash: createHash("sha256").update(styles.join("\n")).digest("hex").slice(0, 16),
      styleCount: styles.length,
      styles,
    };
  };

  const [login, ...rest] = baseline.pages.filter((url) => !url.includes("[id]"));
  await capture(login);
  await loginViaApi(page.request);
  for (const url of rest) await capture(url);
  for (const [api, prefix] of DETAIL_SOURCES) {
    const response = await page.request.get(api);
    expect(response.status(), api).toBe(200);
    const id = ((await response.json()) as { data: { id: string }[] }).data[0]?.id;
    if (id) await capture(`${prefix}${id}`);
  }
  if (out) writeFileSync(out, JSON.stringify(result, null, 2));
});

// ADMIN_SCREENS_OUT=<folder>: screenshot 5 halaman admin utama untuk dibandingkan per piksel sebelum
// dan sesudah perubahan palet publik (mis. palet D). Tanpa variabel itu test dilewati.
test("screenshot admin utama @manual", async ({ page }) => {
  const out = process.env.ADMIN_SCREENS_OUT;
  test.skip(!out, "Butuh ADMIN_SCREENS_OUT.");
  test.setTimeout(180_000);
  mkdirSync(out ?? "", { recursive: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });

  const shoot = async (name: string, url: string) => {
    await page.goto(url);
    await page.waitForLoadState("networkidle");
    await expect(page.locator("[data-slot=skeleton], .animate-pulse, [aria-busy=true]")).toHaveCount(0, { timeout: 20_000 });
    await page.mouse.move(0, 0);
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(out ?? "", `${name}.png`), fullPage: true });
  };

  await shoot("login", "/admin/login");
  await loginViaApi(page.request);
  await shoot("dashboard", "/admin");
  await shoot("pelatihan-daftar", "/admin/trainings");
  const training = (await (await page.request.get("/api/admin/trainings?pageSize=1")).json()) as { data: { id: string }[] };
  await shoot("pelatihan-form", training.data[0] ? `/admin/trainings/${training.data[0].id}` : "/admin/trainings/new");
  const sections = (await (await page.request.get("/api/admin/home-sections")).json()) as { data: { id: string; type: string }[] };
  const hero = sections.data.find((section) => section.type === "HERO") ?? sections.data[0];
  await shoot("editor-beranda", hero ? `/admin/home/${hero.id}` : "/admin/home");
});
