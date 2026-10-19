// Gambar beranda dari seed-data, supaya database yang belum punya gambar (VPS) tampil seperti dev:
// - Slide hero dari seed-data/hero/*.webp, hanya kalau hero belum punya slide (termasuk gambar hero
//   lama, lihat legacyHeroToSlides).
// - Gambar kategori dari seed-data/category-images.json (file di seed-data/covers/), hanya untuk kategori
//   yang gambarnya masih kosong. Accounting diatur seed-manifest-gallery.ts.
// Tidak pernah menimpa pilihan admin. Foto yang sudah pernah diunggah (nama file asli sama, belum di
// Sampah) dipakai ulang, jadi aman dijalankan ulang.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { Prisma } from "../src/generated/prisma/client";
import { getDb } from "../src/lib/db";
import { RevalidateTag, revalidateTags } from "../src/lib/revalidate";
import { legacyHeroToSlides, safeParseHomeSectionContent, type HeroSlide } from "../src/lib/validators/home-section";
import { AuditAction, writeAudit } from "../src/services/audit";
import { uploadMedia } from "../src/services/media";

const SEED_DATA = path.join(__dirname, "seed-data");

// Urutan = urutan slide. Foto dokumentasi milik pemilik (dev, 19 Okt 2026), bukan foto mockup.
const HERO_SLIDES = [
  { file: "kota-senja.webp", alt: "Pemandangan kota dari udara saat senja" },
  { file: "fjord.webp", alt: "Fjord biru dilihat dari puncak tebing" },
  { file: "lembah.webp", alt: "Lembah hijau dengan jalan berkelok" },
  { file: "air-terjun.webp", alt: "Air terjun di tengah hutan dilihat dari atas" },
];

const categoryImagesSchema = z.record(z.string(), z.object({ file: z.string().min(1), alt: z.string().min(1).max(200) }));

const db = getDb();

type SeedPhoto = { name: string; filePath: string; alt: string };

// Unggah foto yang belum ada (atau hanya ada di Sampah); kembalikan peta nama file asli -> id media.
async function ensureMedia(photos: SeedPhoto[], userId: string): Promise<Map<string, string>> {
  const existing = await db.media.findMany({
    where: { originalName: { in: photos.map((photo) => photo.name) }, deletedAt: null },
    select: { id: true, originalName: true, alt: true },
  });
  const ids = new Map(existing.map((media) => [media.originalName as string, media.id]));
  for (const photo of photos) {
    if (ids.has(photo.name)) continue;
    const data = new Uint8Array(await readFile(photo.filePath));
    const { created, failed } = await uploadMedia([{ name: photo.name, data }], { folder: null, userId, revalidate: false });
    if (failed.length > 0) throw new Error(`Gagal mengunggah ${photo.name}: ${failed[0].message}`);
    await db.media.update({ where: { id: created[0].id }, data: { alt: photo.alt } });
    ids.set(photo.name, created[0].id);
  }
  // Media lama tanpa alt: isi alt (wajib untuk gambar publik). Alt yang sudah diisi admin tidak diubah.
  const withoutAlt = existing.filter((media) => !media.alt);
  for (const media of withoutAlt) {
    const photo = photos.find((item) => item.name === media.originalName);
    if (photo) await db.media.update({ where: { id: media.id }, data: { alt: photo.alt } });
  }
  return ids;
}

async function seedHeroSlides(userId: string): Promise<number> {
  const hero = await db.homeSection.findFirst({ where: { type: "HERO", deletedAt: null } });
  if (!hero) return 0;
  const raw = legacyHeroToSlides(hero.content);
  // Isi rusak dibiarkan (admin yang memperbaiki); hero yang sudah punya slide tidak disentuh.
  const parsed = safeParseHomeSectionContent("HERO", raw);
  if (!parsed || parsed.slides.length > 0) return 0;

  const photos = HERO_SLIDES.map((slide) => ({
    name: `hero--${slide.file}`,
    filePath: path.join(SEED_DATA, "hero", slide.file),
    alt: slide.alt,
  }));
  const ids = await ensureMedia(photos, userId);
  const slides: HeroSlide[] = photos.map((photo) => ({
    mediaId: ids.get(photo.name) as string,
    alt: "",
    caption: "",
    href: "",
    hudLabel: "",
    focalX: 50,
    focalY: 50,
  }));
  // Isi lain section tetap seperti di DB; hanya slides yang diisi.
  const content = { ...(raw as Record<string, unknown>), slides } as Prisma.InputJsonValue;
  await db.$transaction(async (tx) => {
    await tx.homeSection.update({ where: { id: hero.id }, data: { content, updatedById: userId } });
    await writeAudit(
      {
        userId,
        action: AuditAction.UPDATE,
        entity: "HomeSection",
        entityId: hero.id,
        diff: { slides: { from: [], to: slides.map((slide) => slide.mediaId) } },
      },
      tx,
    );
  });
  return slides.length;
}

async function seedCategoryImages(userId: string): Promise<string[]> {
  const map = categoryImagesSchema.parse(
    JSON.parse(await readFile(path.join(SEED_DATA, "category-images.json"), "utf8")),
  );
  const categories = await db.category.findMany({
    where: { deletedAt: null, imageId: null, slug: { in: Object.keys(map) } },
    select: { id: true, slug: true },
  });
  if (categories.length === 0) return [];

  const photos = categories.map((category) => ({
    name: map[category.slug].file,
    filePath: path.join(SEED_DATA, "covers", map[category.slug].file),
    alt: map[category.slug].alt,
  }));
  const ids = await ensureMedia(photos, userId);
  await db.$transaction(async (tx) => {
    for (const category of categories) {
      const imageId = ids.get(map[category.slug].file) as string;
      await tx.category.update({ where: { id: category.id }, data: { imageId, updatedById: userId } });
      await writeAudit(
        {
          userId,
          action: AuditAction.UPDATE,
          entity: "Category",
          entityId: category.id,
          diff: { imageId: { from: null, to: imageId } },
        },
        tx,
      );
    }
  });
  return categories.map((category) => category.slug);
}

export async function seedHomeImages(): Promise<{ heroSlides: number; categories: number } | "dilewati"> {
  const owner = await db.user.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } });
  if (!owner) return "dilewati";

  const heroSlides = await seedHeroSlides(owner.id);
  const categorySlugs = await seedCategoryImages(owner.id);
  if (heroSlides === 0 && categorySlugs.length === 0) return "dilewati";

  // Seperti seed.ts: revalidate hanya kalau FE bisa dihubungi dari sini (database baru belum punya cache).
  if (process.env.FE_REVALIDATE_URL && process.env.REVALIDATE_SECRET) await revalidateTags([
    RevalidateTag.MEDIA,
    ...(heroSlides > 0 ? [RevalidateTag.HOME] : []),
    ...(categorySlugs.length > 0 ? [RevalidateTag.CATEGORIES, ...categorySlugs.map(RevalidateTag.category)] : []),
  ]);
  return { heroSlides, categories: categorySlugs.length };
}
