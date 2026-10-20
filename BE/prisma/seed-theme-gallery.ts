// Foto tema (seed-data/gallery/themes.json, lihat seed-data/themes.ts) untuk semua kategori dan
// pelatihan di luar manifest accounting (permintaan pemilik, 20 Okt 2026: foto orang Indonesia).
// Dipakai seed.ts (juga saat deploy) dan skrip `npm run db:seed:themes` (dry run di dev).
// - Gambar kategori diisi kalau kosong atau masih gambar bawaan seed (ilustrasi seed-data/covers/,
//   foto tema lain, atau foto tema yang dipensiunkan). Gambar unggahan admin tidak disentuh.
// - Pelatihan: sampul diisi kalau kosong atau foto tema yang dipensiunkan; galeri (4 foto) diisi kalau
//   kosong. Tema mengikuti kategori pertama pelatihan (urutan kategori).
// - updatedById tidak diisi: seed katalog referensi memakai kolom itu untuk mengenali suntingan admin.
// - Foto yang sudah pernah diunggah (nama file asli sama, belum di Sampah) dipakai ulang.
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { getDb } from "../src/lib/db";
import { RevalidateTag, revalidateTags } from "../src/lib/revalidate";
import { AuditAction, writeAudit } from "../src/services/audit";
import { uploadMedia } from "../src/services/media";
import {
  categoryPhoto,
  loadThemes,
  THEMES_DIR,
  themeFor,
  themeUploadName,
  trainingPhotos,
  type ThemePhoto,
} from "./seed-data/themes";

const db = getDb();
const COVERS_DIR = path.join(__dirname, "seed-data", "covers");
const MANIFEST_FILE = path.join(__dirname, "seed-data", "gallery", "manifest.json");
const BATCH_SIZE = 100;

type CategoryStep = { id: string; slug: string; theme: string; photo: ThemePhoto; previousImageId: string | null };
type TrainingStep = {
  id: string;
  slug: string;
  theme: string;
  cover: ThemePhoto | null;
  gallery: ThemePhoto[] | null;
  previousCoverId: string | null;
};
export type ThemePlan = {
  categories: CategoryStep[];
  trainings: TrainingStep[];
  // Kategori yang gambarnya dipilih admin (tidak disentuh).
  keptCategories: number;
};

export async function planThemeGallery(): Promise<ThemePlan> {
  const themes = loadThemes();
  const poolNames = new Set(themes.themes.flatMap((theme) => theme.photos.map((photo) => themeUploadName(photo.file))));
  const retired = new Set(themes.retired.map(themeUploadName));
  const coverFiles = new Set((await readdir(COVERS_DIR).catch(() => [] as string[])).filter((name) => name.endsWith(".jpg")));
  // Kategori di manifest accounting diatur seed-manifest-gallery.ts.
  const manifest = JSON.parse(await readFile(MANIFEST_FILE, "utf8")) as { categories: Record<string, unknown> };
  const manifestSlugs = Object.keys(manifest.categories);

  const isSeedImage = (name: string | null | undefined) =>
    !!name && (coverFiles.has(name) || poolNames.has(name) || retired.has(name));

  const categories: CategoryStep[] = [];
  let keptCategories = 0;
  const rows = await db.category.findMany({
    where: { deletedAt: null, slug: { notIn: manifestSlugs } },
    orderBy: [{ order: "asc" }, { slug: "asc" }],
    select: { id: true, slug: true, imageId: true, image: { select: { originalName: true, deletedAt: true } } },
  });
  for (const row of rows) {
    const photo = categoryPhoto(themes, row.slug);
    const current = row.image && row.image.deletedAt === null ? row.image.originalName : null;
    if (current === themeUploadName(photo.file)) continue;
    if (row.imageId && current !== null && !isSeedImage(current)) {
      keptCategories += 1;
      continue;
    }
    categories.push({ id: row.id, slug: row.slug, theme: themeFor(themes, row.slug).key, photo, previousImageId: row.imageId });
  }

  const trainings: TrainingStep[] = [];
  const trainingRows = await db.training.findMany({
    where: { deletedAt: null },
    orderBy: { slug: "asc" },
    select: {
      id: true,
      slug: true,
      coverId: true,
      cover: { select: { originalName: true } },
      _count: { select: { images: true } },
      categories: { select: { category: { select: { slug: true, order: true, deletedAt: true } } } },
    },
  });
  for (const row of trainingRows) {
    const coverFree = !row.coverId || retired.has(row.cover?.originalName ?? "");
    const galleryFree = row._count.images === 0;
    if (!coverFree && !galleryFree) continue;
    const category = row.categories
      .map((link) => link.category)
      .filter((item) => item.deletedAt === null)
      .sort((a, b) => a.order - b.order || a.slug.localeCompare(b.slug))[0];
    const picked = trainingPhotos(themes, category?.slug ?? null, row.slug);
    trainings.push({
      id: row.id,
      slug: row.slug,
      theme: themeFor(themes, category?.slug).key,
      cover: coverFree ? picked.cover : null,
      gallery: galleryFree ? picked.gallery : null,
      previousCoverId: row.coverId,
    });
  }
  return { categories, trainings, keptCategories };
}

// Unggah foto pool yang dipakai rencana ini dan belum ada di media library; kembalikan nama -> id media.
async function ensureMedia(photos: ThemePhoto[], userId: string): Promise<{ ids: Map<string, string>; uploaded: number }> {
  const unique = [...new Map(photos.map((photo) => [themeUploadName(photo.file), photo])).values()];
  const existing = await db.media.findMany({
    where: { originalName: { in: unique.map((photo) => themeUploadName(photo.file)) }, deletedAt: null },
    select: { id: true, originalName: true },
  });
  const ids = new Map(existing.map((media) => [media.originalName as string, media.id]));
  let uploaded = 0;
  for (const photo of unique) {
    const name = themeUploadName(photo.file);
    if (!ids.has(name)) {
      const data = new Uint8Array(await readFile(path.join(THEMES_DIR, photo.file)));
      const { created, failed } = await uploadMedia([{ name, data }], { folder: null, userId, revalidate: false });
      if (failed.length > 0) throw new Error(`Gagal mengunggah ${photo.file}: ${failed[0].message}`);
      ids.set(name, created[0].id);
      uploaded += 1;
    }
    // Alt wajib untuk gambar yang tampil di publik.
    await db.media.update({ where: { id: ids.get(name) as string }, data: { alt: photo.alt } });
  }
  return { ids, uploaded };
}

export async function applyThemeGallery(plan: ThemePlan): Promise<{ uploaded: number; revalidated: boolean }> {
  const owner = await db.user.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } });
  if (!owner) throw new Error("Belum ada admin. Jalankan seed dulu.");

  const photos = [
    ...plan.categories.map((step) => step.photo),
    ...plan.trainings.flatMap((step) => [...(step.cover ? [step.cover] : []), ...(step.gallery ?? [])]),
  ];
  const { ids, uploaded } = await ensureMedia(photos, owner.id);
  const mediaId = (photo: ThemePhoto) => ids.get(themeUploadName(photo.file)) as string;

  for (let index = 0; index < plan.categories.length; index += BATCH_SIZE) {
    const batch = plan.categories.slice(index, index + BATCH_SIZE);
    await db.$transaction(async (tx) => {
      for (const step of batch) {
        await tx.category.update({ where: { id: step.id }, data: { imageId: mediaId(step.photo) } });
        await writeAudit(
          {
            userId: owner.id,
            action: AuditAction.UPDATE,
            entity: "Category",
            entityId: step.id,
            diff: { imageId: { from: step.previousImageId, to: mediaId(step.photo) } },
          },
          tx,
        );
      }
    });
  }

  for (let index = 0; index < plan.trainings.length; index += BATCH_SIZE) {
    const batch = plan.trainings.slice(index, index + BATCH_SIZE);
    await db.$transaction(async (tx) => {
      for (const step of batch) {
        const diff: { coverId?: { from: string | null; to: string }; imageIds?: { from: string[]; to: string[] } } = {};
        if (step.cover) {
          await tx.training.update({ where: { id: step.id }, data: { coverId: mediaId(step.cover) } });
          diff.coverId = { from: step.previousCoverId, to: mediaId(step.cover) };
        }
        if (step.gallery) {
          const imageIds = step.gallery.map(mediaId);
          await tx.trainingImage.createMany({
            data: imageIds.map((id, order) => ({ trainingId: step.id, mediaId: id, order })),
            skipDuplicates: true,
          });
          diff.imageIds = { from: [], to: imageIds };
        }
        await writeAudit({ userId: owner.id, action: AuditAction.UPDATE, entity: "Training", entityId: step.id, diff }, tx);
      }
    });
  }

  // Seperti seed.ts: revalidate hanya kalau FE bisa dihubungi dari sini.
  const revalidated =
    !!process.env.FE_REVALIDATE_URL &&
    !!process.env.REVALIDATE_SECRET &&
    (await revalidateTags([
      RevalidateTag.MEDIA,
      RevalidateTag.CATEGORIES,
      RevalidateTag.TRAININGS,
      RevalidateTag.HOME,
      ...plan.categories.map((step) => RevalidateTag.category(step.slug)),
      ...plan.trainings.map((step) => RevalidateTag.training(step.slug)),
    ]));
  return { uploaded, revalidated };
}

// Untuk seed.ts: rencanakan lalu terapkan kalau ada yang perlu diubah.
export async function seedThemeGallery(): Promise<{ categories: number; trainings: number } | "dilewati"> {
  const plan = await planThemeGallery();
  if (plan.categories.length === 0 && plan.trainings.length === 0) return "dilewati";
  await applyThemeGallery(plan);
  return { categories: plan.categories.length, trainings: plan.trainings.length };
}
