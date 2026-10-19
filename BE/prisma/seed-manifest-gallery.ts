// Foto dari seed-data/gallery/manifest.json: gambar kategori, sampul, dan galeri pelatihan. Dipakai
// seed.ts (juga saat deploy) dan skrip `npm run db:seed:gallery` (dry run di dev).
// - Gambar kategori diganti dengan foto di manifest (permintaan pemilik, 19 Okt 2026). Media lama tidak
//   dihapus, tetap di media library.
// - Sampul dan galeri pelatihan hanya diisi kalau masih kosong atau masih berisi foto pool accounting
//   versi awal (seed-gallery.ts sebelum 19 Okt 2026; pemilik minta accounting memakai foto manifest).
//   Pilihan admin lainnya tidak tertimpa.
// - Foto yang sudah pernah diunggah (nama file asli sama, belum di Sampah) dipakai ulang, jadi aman
//   dijalankan ulang.
// Semua foto berlisensi CC0 (sumber per foto dicatat di manifest).
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
});
type Photo = z.infer<typeof photoSchema>;

const db = getDb();

// Nama file asli di media library: unik per foto, dipakai untuk mendeteksi unggahan sebelumnya.
const uploadName = (photo: Photo) => photo.file.replaceAll("/", "--");

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
};
export type ManifestPlan = {
  categories: CategoryStep[];
  trainings: TrainingStep[];
  unchanged: { slug: string; reasons: string[] }[];
  missing: string[];
};

export async function planManifestGallery(): Promise<ManifestPlan> {
  const manifest = manifestSchema.parse(JSON.parse(await readFile(path.join(GALLERY_DIR, "manifest.json"), "utf8")));
  const missing: string[] = [];
  const categories: CategoryStep[] = [];
  for (const [slug, photo] of Object.entries(manifest.categories)) {
    const row = await db.category.findFirst({ where: { slug, deletedAt: null }, include: { image: true } });
    if (!row) {
      missing.push(`kategori ${slug}`);
      continue;
    }
    if (row.image?.originalName === uploadName(photo) && row.image.deletedAt === null) continue;
    categories.push({ id: row.id, slug, name: row.name, photo, currentName: row.image?.originalName ?? null });
  }

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
      },
    });
    if (!row) {
      missing.push(`pelatihan ${slug}`);
      continue;
    }
    const coverFree = !row.coverId || isLegacyPoolPhoto(row.cover?.originalName);
    const galleryFree = row.images.every((image) => isLegacyPoolPhoto(image.media.originalName));
    const step = {
      id: row.id,
      slug,
      title: row.title,
      cover: coverFree ? entry.cover : null,
      gallery: galleryFree ? entry.gallery : null,
      previousCoverId: row.coverId,
      previousImageIds: row.images.map((image) => image.mediaId),
    };
    if (step.cover || step.gallery) trainings.push(step);
    else {
      unchanged.push({ slug, reasons: ["sampul sudah ada", `galeri sudah berisi ${row.images.length} foto`] });
    }
  }
  return { categories, trainings, unchanged, missing };
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
      const diff: { coverId?: { from: string | null; to: string }; imageIds?: { from: string[]; to: string[] } } = {};
      if (step.cover) {
        await tx.training.update({ where: { id: step.id }, data: { coverId: mediaId(step.cover), updatedById: owner.id } });
        diff.coverId = { from: step.previousCoverId, to: mediaId(step.cover) };
      }
      if (step.gallery) {
        const imageIds = step.gallery.map(mediaId);
        // Hanya tautan ke foto pool lama yang dilepas (lihat planManifestGallery); medianya tetap ada.
        await tx.trainingImage.deleteMany({ where: { trainingId: step.id } });
        await tx.trainingImage.createMany({
          data: imageIds.map((id, order) => ({ trainingId: step.id, mediaId: id, order })),
        });
        diff.imageIds = { from: step.previousImageIds, to: imageIds };
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
      ...steps.categories.map((step) => RevalidateTag.category(step.slug)),
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
