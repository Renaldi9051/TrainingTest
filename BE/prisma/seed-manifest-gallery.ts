// Foto dari seed-data/gallery/manifest.json: gambar kategori, sampul, dan galeri pelatihan. Dipakai
// seed.ts (juga saat deploy) dan skrip `npm run db:seed:gallery` (dry run di dev).
// - Gambar kategori diganti dengan foto di manifest (permintaan pemilik, 19 Okt 2026). Media lama tidak
//   dihapus, tetap di media library.
// - Sampul dan galeri pelatihan hanya diisi kalau masih kosong atau masih berisi foto yang sudah
//   dipensiunkan: foto pool accounting versi awal (seed-gallery.ts sebelum 19 Okt 2026) dan foto
//   manifest di daftar `retired` (foto berisi orang diganti foto orang Indonesia, permintaan pemilik
//   20 Okt 2026). Galeri hanya diganti kalau seluruh isinya foto seed; pilihan admin tidak tertimpa.
// - Pelatihan di manifest ditautkan ke kategori manifest (accounting) hanya kalau belum punya kategori
//   aktif sama sekali (satu pelatihan satu kategori, 21 Okt 2026). Penempatan ke accounting diatur seed
//   satu kategori (seed-single-category.ts, loadManifestPins), jadi pilihan admin tidak tertimpa.
// - Foto yang sudah pernah diunggah (nama file asli sama, belum di Sampah) dipakai ulang, jadi aman
//   dijalankan ulang.
// Foto berlisensi CC0, Unsplash License, atau Pexels License (sumber per foto dicatat di manifest).
// Mengganti foto: simpan dengan nama file baru dan pindahkan nama lama ke `retired`, karena nama file
// yang sama dianggap sudah diunggah.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { getDb } from "../src/lib/db";
import { RevalidateTag, revalidateTags } from "../src/lib/revalidate";
import { AuditAction, writeAudit } from "../src/services/audit";
import { uploadMedia } from "../src/services/media";

const GALLERY_DIR = path.join(__dirname, "seed-data", "gallery");

const photoSchema = z.object({
  file: z.string().min(1),
  alt: z.string().min(1).max(200),
  source: z.object({ provider: z.string(), creator: z.string().nullable(), license: z.string(), url: z.string() }),
});
const manifestSchema = z.object({
  categories: z.record(z.string(), photoSchema),
  trainings: z.record(z.string(), z.object({ cover: photoSchema, gallery: z.array(photoSchema).min(1).max(6) })),
  // File foto manifest versi sebelumnya yang sudah diganti (filenya sudah dihapus dari repo).
  retired: z.array(z.string().min(1)).default([]),
});
type Photo = z.infer<typeof photoSchema>;

const db = getDb();

// Nama file asli di media library: unik per foto, dipakai untuk mendeteksi unggahan sebelumnya.
const fileUploadName = (file: string) => file.replaceAll("/", "--");
const uploadName = (photo: Photo) => fileUploadName(photo.file);

// Foto pool accounting versi awal (seed-data/gallery/accounting-NN.jpg, sudah dihapus dari repo).
export const isLegacyPoolPhoto = (originalName: string | null | undefined) =>
  !!originalName && /^accounting-\d+\.jpg$/.test(originalName);

type CategoryStep = { id: string; slug: string; name: string; photo: Photo; currentName: string | null };
type TrainingStep = {
  id: string;
  slug: string;
  title: string;
  cover: Photo | null;
  gallery: Photo[] | null;
  previousCoverId: string | null;
  previousImageIds: string[];
  // Kategori manifest yang belum tertaut ke pelatihan ini.
  categoryIds: string[];
};
export type ManifestPlan = {
  // Semua kategori manifest yang ada (untuk tautan & revalidate), terlepas dari perlu-tidaknya ganti gambar.
  manifestCategories: { id: string; slug: string }[];
  categories: CategoryStep[];
  trainings: TrainingStep[];
  unchanged: { slug: string; reasons: string[] }[];
  missing: string[];
};

async function readManifest() {
  return manifestSchema.parse(JSON.parse(await readFile(path.join(GALLERY_DIR, "manifest.json"), "utf8")));
}

// Slug pelatihan manifest -> slug kategori manifest pertama (accounting); dipakai seed satu kategori.
export async function loadManifestPins(): Promise<Map<string, string>> {
  const manifest = await readManifest();
  const category = Object.keys(manifest.categories)[0];
  return new Map(category ? Object.keys(manifest.trainings).map((slug) => [slug, category]) : []);
}

export async function planManifestGallery(): Promise<ManifestPlan> {
  const manifest = await readManifest();
  const missing: string[] = [];
  const manifestCategories: ManifestPlan["manifestCategories"] = [];
  const categories: CategoryStep[] = [];
  for (const [slug, photo] of Object.entries(manifest.categories)) {
    const row = await db.category.findFirst({ where: { slug, deletedAt: null }, include: { image: true } });
    if (!row) {
      missing.push(`kategori ${slug}`);
      continue;
    }
    manifestCategories.push({ id: row.id, slug });
    if (row.image?.originalName === uploadName(photo) && row.image.deletedAt === null) continue;
    categories.push({ id: row.id, slug, name: row.name, photo, currentName: row.image?.originalName ?? null });
  }

  // Foto yang boleh diganti, dan semua foto milik seed (termasuk foto manifest yang masih dipakai).
  const retired = new Set(manifest.retired.map(fileUploadName));
  const isReplaceable = (name: string | null | undefined) => isLegacyPoolPhoto(name) || (!!name && retired.has(name));
  const seedNames = new Set(
    Object.values(manifest.trainings).flatMap((entry) => [entry.cover, ...entry.gallery].map(uploadName)),
  );
  const isSeedPhoto = (name: string | null | undefined) => isReplaceable(name) || (!!name && seedNames.has(name));

  const trainings: TrainingStep[] = [];
  const unchanged: ManifestPlan["unchanged"] = [];
  for (const [slug, entry] of Object.entries(manifest.trainings)) {
    const row = await db.training.findFirst({
      where: { slug, deletedAt: null },
      select: {
        id: true,
        title: true,
        coverId: true,
        cover: { select: { originalName: true } },
        images: { select: { mediaId: true, media: { select: { originalName: true } } } },
        categories: { where: { category: { deletedAt: null } }, select: { categoryId: true } },
      },
    });
    if (!row) {
      missing.push(`pelatihan ${slug}`);
      continue;
    }
    const coverFree = !row.coverId || isReplaceable(row.cover?.originalName);
    const names = row.images.map((image) => image.media.originalName);
    const galleryFree = names.length === 0 || (names.every(isSeedPhoto) && names.some(isReplaceable));
    const step = {
      id: row.id,
      slug,
      title: row.title,
      cover: coverFree ? entry.cover : null,
      gallery: galleryFree ? entry.gallery : null,
      previousCoverId: row.coverId,
      previousImageIds: row.images.map((image) => image.mediaId),
      categoryIds: row.categories.length === 0 ? manifestCategories.slice(0, 1).map((category) => category.id) : [],
    };
    if (step.cover || step.gallery || step.categoryIds.length > 0) trainings.push(step);
    else {
      unchanged.push({
        slug,
        reasons: ["sampul sudah ada", `galeri sudah berisi ${row.images.length} foto`, "kategori sudah tertaut"],
      });
    }
  }
  return { manifestCategories, categories, trainings, unchanged, missing };
}

// Unggah foto yang belum ada di media library; kembalikan peta nama file -> id media.
async function ensureMedia(photos: Photo[], userId: string): Promise<{ ids: Map<string, string>; uploaded: number }> {
  const names = photos.map(uploadName);
  const existing = await db.media.findMany({
    where: { originalName: { in: names }, deletedAt: null },
    select: { id: true, originalName: true },
  });
  const ids = new Map(existing.map((media) => [media.originalName as string, media.id]));
  const todo = photos.filter((photo) => !ids.has(uploadName(photo)));
  for (const photo of todo) {
    // Foto yang sama bisa dipakai lebih dari satu langkah: unggah sekali.
    if (ids.has(uploadName(photo))) continue;
    const data = new Uint8Array(await readFile(path.join(GALLERY_DIR, photo.file)));
    const { created, failed } = await uploadMedia([{ name: uploadName(photo), data }], {
      folder: null,
      userId,
      revalidate: false,
    });
    if (failed.length > 0) throw new Error(`Gagal mengunggah ${photo.file}: ${failed[0].message}`);
    ids.set(uploadName(photo), created[0].id);
  }
  // Alt wajib untuk gambar yang tampil di publik (dicek juga oleh validasi admin).
  for (const photo of photos) {
    await db.media.update({ where: { id: ids.get(uploadName(photo)) as string }, data: { alt: photo.alt } });
  }
  return { ids, uploaded: todo.length };
}

// Terapkan rencana. Mengembalikan jumlah media yang baru diunggah dan apakah revalidate FE berhasil.
export async function applyManifestGallery(steps: ManifestPlan): Promise<{ uploaded: number; revalidated: boolean }> {
  const owner = await db.user.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } });
  if (!owner) throw new Error("Belum ada admin. Jalankan seed dulu.");

  const photos = [
    ...steps.categories.map((step) => step.photo),
    ...steps.trainings.flatMap((step) => [...(step.cover ? [step.cover] : []), ...(step.gallery ?? [])]),
  ];
  const { ids, uploaded } = await ensureMedia(photos, owner.id);
  const mediaId = (photo: Photo) => ids.get(uploadName(photo)) as string;

  await db.$transaction(async (tx) => {
    for (const step of steps.categories) {
      const before = await tx.category.findUniqueOrThrow({ where: { id: step.id }, select: { imageId: true } });
      await tx.category.update({ where: { id: step.id }, data: { imageId: mediaId(step.photo), updatedById: owner.id } });
      await writeAudit(
        {
          userId: owner.id,
          action: AuditAction.UPDATE,
          entity: "Category",
          entityId: step.id,
          diff: { imageId: { from: before.imageId, to: mediaId(step.photo) } },
        },
        tx,
      );
    }
    for (const step of steps.trainings) {
      const diff: {
        coverId?: { from: string | null; to: string };
        imageIds?: { from: string[]; to: string[] };
        categoryIds?: { added: string[] };
      } = {};
      if (step.cover) {
        await tx.training.update({ where: { id: step.id }, data: { coverId: mediaId(step.cover), updatedById: owner.id } });
        diff.coverId = { from: step.previousCoverId, to: mediaId(step.cover) };
      }
      if (step.gallery) {
        const imageIds = step.gallery.map(mediaId);
        // Hanya galeri yang seluruhnya foto seed yang dilepas (lihat planManifestGallery); medianya tetap ada.
        await tx.trainingImage.deleteMany({ where: { trainingId: step.id } });
        await tx.trainingImage.createMany({
          data: imageIds.map((id, order) => ({ trainingId: step.id, mediaId: id, order })),
        });
        diff.imageIds = { from: step.previousImageIds, to: imageIds };
      }
      if (step.categoryIds.length > 0) {
        await tx.trainingCategory.createMany({
          data: step.categoryIds.map((categoryId) => ({ trainingId: step.id, categoryId })),
          skipDuplicates: true,
        });
        diff.categoryIds = { added: step.categoryIds };
      }
      await writeAudit(
        { userId: owner.id, action: AuditAction.UPDATE, entity: "Training", entityId: step.id, diff },
        tx,
      );
    }
  });

  // Seperti seed.ts: revalidate hanya kalau FE bisa dihubungi dari sini.
  const revalidated =
    !!process.env.FE_REVALIDATE_URL &&
    !!process.env.REVALIDATE_SECRET &&
    (await revalidateTags([
      RevalidateTag.MEDIA,
      RevalidateTag.CATEGORIES,
      RevalidateTag.TRAININGS,
      ...steps.manifestCategories.map((category) => RevalidateTag.category(category.slug)),
      ...steps.trainings.map((step) => RevalidateTag.training(step.slug)),
    ]));
  return { uploaded, revalidated };
}

// Untuk seed.ts: rencanakan lalu terapkan kalau ada yang perlu diubah.
export async function seedManifestGallery(): Promise<{ categories: number; trainings: number } | "dilewati"> {
  const steps = await planManifestGallery();
  if (steps.categories.length === 0 && steps.trainings.length === 0) return "dilewati";
  await applyManifestGallery(steps);
  return { categories: steps.categories.length, trainings: steps.trainings.length };
}
