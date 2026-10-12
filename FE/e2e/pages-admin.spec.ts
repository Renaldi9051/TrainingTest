import { readFile } from "node:fs/promises";
import path from "node:path";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { loginViaApi, ORIGIN, runId } from "./helpers";

// Editor halaman (3.3): blok baru langsung terbuka & fokus, error blok (validasi form dan BE
// blocks.N.field) membuka kartu yang tepat dan men-scroll ke sana, hapus blok lewat "Urungkan",
// urutan blok lewat keyboard, pratinjau nonaktif saat ada perubahan. Data uji berawalan [UJI].

const HEADERS = { Origin: ORIGIN };

async function uploadImage(request: APIRequestContext, name: string, alt: string | null): Promise<string> {
  const buffer = await readFile(path.join(__dirname, "fixtures", "sample.png"));
  const response = await request.post("/api/admin/media", {
    headers: HEADERS,
    multipart: { files: { name, mimeType: "image/png", buffer }, folder: "uji" },
  });
  expect(response.status(), await response.text()).toBe(201);
  const id = ((await response.json()) as { data: { created: { id: string }[] } }).data.created[0].id;
  if (alt) {
    const patch = await request.patch(`/api/admin/media/${id}`, { headers: HEADERS, data: { alt } });
    expect(patch.status()).toBe(200);
  }
  return id;
}

const field = (page: Page, name: string) => page.getByRole("textbox", { name, exact: true });

async function addBlock(page: Page, label: string) {
  await page.getByRole("button", { name: "Tambah blok" }).click();
  await page.getByRole("menuitem", { name: new RegExp(`^${label}`) }).click();
}

// Pindah blok satu posisi ke atas lewat keyboard dnd-kit.
async function moveBlockUp(page: Page, gripLabel: string) {
  await page.getByRole("button", { name: `Ubah urutan ${gripLabel}`, exact: true }).focus();
  await page.keyboard.press("Space");
  await page.waitForTimeout(200);
  await page.keyboard.press("ArrowUp");
  await page.waitForTimeout(200);
  await page.keyboard.press("Space");
}

async function pageBlocks(request: APIRequestContext, id: string): Promise<{ type: string; heading?: string }[]> {
  const response = await request.get(`/api/admin/pages/${id}`);
  return ((await response.json()) as { data: { blocks: { type: string; heading?: string }[] } }).data.blocks;
}

test.describe("editor halaman", () => {
  test("buat halaman berblok: fokus blok baru, error per kartu, urungkan hapus, urutkan, tayang", async ({ page }) => {
    await loginViaApi(page.request);
    const id = runId();
    await uploadImage(page.request, `[UJI]-tanpa-alt-${id}.png`, null);

    await page.goto("/admin/pages/new");
    await field(page, "Judul").fill(`[UJI] Syarat ${id}`);

    // Blok baru langsung terbuka dan fokus pindah ke field pertamanya.
    await addBlock(page, "Teks");
    await expect(field(page, "Eyebrow")).toBeFocused();
    await field(page, "Judul blok").fill("Ketentuan umum");
    await page.getByRole("textbox", { name: "Isi teks" }).click();
    await page.keyboard.type("Isi ketentuan umum untuk uji.");

    await addBlock(page, "Daftar");
    await expect(page.getByRole("textbox", { name: "Eyebrow" }).last()).toBeFocused();
    await page.getByRole("textbox", { name: "Judul blok" }).last().fill("Poin penting");
    await page.getByRole("textbox", { name: "Item 1", exact: true }).fill("Poin pertama");

    await addBlock(page, "Gambar");
    // Lipat kartu gambar (belum dipilih) supaya terbukti kartu dibuka otomatis saat error.
    await page.getByRole("button", { name: "Lipat Blok 3 (Gambar)" }).click();
    await expect(page.getByRole("button", { name: "Buka Blok 3 (Gambar)" })).toHaveAttribute("aria-expanded", "false");

    // 1) Validasi form: gambar belum dipilih -> kartu 3 terbuka, error terlihat di layar.
    await page.getByRole("button", { name: "Simpan", exact: true }).click();
    const imageError = page.getByText("Pilih gambar.", { exact: true });
    await expect(imageError).toBeVisible();
    await expect(imageError).toBeInViewport();
    await expect(page.getByText("Blok 3 perlu diperbaiki.")).toBeVisible();

    // 2) Error BE blocks.2.image: gambar tanpa alt ditolak saat simpan, kartu dibuka lagi.
    await page.locator("button", { hasText: "Pilih gambar" }).first().click();
    const picker = page.getByRole("dialog");
    await picker.getByRole("searchbox").fill(`tanpa-alt-${id}`);
    await picker.getByRole("button", { name: `Pilih [UJI]-tanpa-alt-${id}.png`, exact: true }).click();
    await picker.getByRole("button", { name: "Pakai gambar ini" }).click();
    await page.getByRole("button", { name: "Lipat Blok 3 (Gambar)" }).click();
    await page.getByRole("button", { name: "Simpan", exact: true }).click();
    const altError = page.getByText("Gambar belum punya teks alt. Isi alt di media library dulu.");
    await expect(altError).toBeVisible();
    await expect(altError).toBeInViewport();
    await expect(page.getByRole("button", { name: "Lipat Blok 3 (Gambar)" })).toHaveAttribute("aria-expanded", "true");

    // Hapus blok gambar tanpa dialog konfirmasi, lalu Urungkan mengembalikannya ke posisi 3.
    await page.getByRole("button", { name: "Hapus Blok 3 (Gambar)" }).click();
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Blok 3 \(Gambar\)/ })).toHaveCount(0);
    // Tombol "Urungkan" di toast (bukan tombol undo toolbar rich text).
    await page.locator("[data-sonner-toast]").getByRole("button", { name: "Urungkan" }).click();
    await expect(page.getByRole("button", { name: "Hapus Blok 3 (Gambar)" })).toBeVisible();
    // Hapus lagi untuk simpan tanpa gambar tanpa alt.
    await page.getByRole("button", { name: "Hapus Blok 3 (Gambar)" }).click();

    // Urutkan: Daftar naik ke posisi 1.
    await moveBlockUp(page, "blok 2 (Daftar)");
    await expect(page.getByRole("button", { name: "Hapus Blok 1 (Daftar)" })).toBeVisible();

    await page.getByText("Tayang", { exact: true }).click();
    await page.getByRole("button", { name: "Simpan", exact: true }).click();
    await page.waitForURL(/\/admin\/pages\/[0-9a-f-]{36}$/);
    await expect(page.getByText(/Halaman disimpan dan tayang/).first()).toBeVisible();
    const pageId = page.url().split("/").pop() ?? "";
    expect((await pageBlocks(page.request, pageId)).map((block) => block.type)).toEqual(["LIST", "RICH_TEXT"]);

    // Pratinjau nonaktif selama ada perubahan.
    await expect(page.getByRole("link", { name: /Pratinjau/ })).toBeVisible();
    await field(page, "Judul").fill(`[UJI] Syarat ${id} (ubah)`);
    await expect(page.getByRole("button", { name: /Pratinjau/ })).toBeDisabled();

    // Publik: tampil di daftar halaman statis.
    const list = await page.request.get("/api/public/pages");
    const slugs = ((await list.json()) as { data: { slug: string }[] }).data.map((item) => item.slug);
    expect(slugs).toContain(`uji-syarat-${id}`);
  });

  test("slug route situs ditolak; daftar publik tanpa halaman profil", async ({ page }) => {
    await loginViaApi(page.request);
    const response = await page.request.post("/api/admin/pages", {
      headers: HEADERS,
      data: { title: "[UJI] Bentrok", slug: "kontak" },
    });
    expect(response.status()).toBe(422);
    const list = await page.request.get("/api/public/pages");
    expect(list.status()).toBe(200);
    const kinds = await Promise.all(
      ((await list.json()) as { data: { slug: string }[] }).data.map(async (item) => {
        const detail = await page.request.get(`/api/public/pages/${item.slug}`);
        return ((await detail.json()) as { data: { kind: string } }).data.kind;
      }),
    );
    expect(kinds).not.toContain("PROFILE");
  });

  // Halaman profil dibuat seed (3.6). Sebelum itu test ini dilewati.
  test("halaman profil: slug terkunci (422) dan tidak bisa dihapus (409) @manual", async ({ page }) => {
    await loginViaApi(page.request);
    const response = await page.request.get("/api/admin/pages?q=profil&pageSize=50");
    const profile = ((await response.json()) as { data: { id: string; kind: string }[] }).data.find(
      (item) => item.kind === "PROFILE",
    );
    test.skip(!profile, "Butuh halaman profil dari seed (Fase 3.6).");
    if (!profile) return;

    const rename = await page.request.patch(`/api/admin/pages/${profile.id}`, {
      headers: HEADERS,
      data: { slug: "tentang-kami" },
    });
    expect(rename.status()).toBe(422);
    const remove = await page.request.delete(`/api/admin/pages/${profile.id}`, { headers: HEADERS });
    expect(remove.status()).toBe(409);

    await page.goto(`/admin/pages/${profile.id}`);
    await expect(page.getByText("Halaman sistem: alamatnya tetap dan tidak bisa diubah.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Hapus halaman" })).toHaveCount(0);
  });
});
