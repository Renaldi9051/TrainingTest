// Foto unik per pelatihan sesuai topik judulnya (permintaan pemilik, 21 Okt 2026: foto tidak boleh
// berulang dan harus nyambung dengan topik). Daftar foto ada di seed-data/gallery/training-photos.json:
// foto Pexels (Pexels License) yang dipilih manual, 1 sampul + 4 galeri per pelatihan, alt bahasa
// Indonesia. Uji coba pertama: kategori berawalan A dan B.
// - File foto tidak disimpan di repo; seed mengunduhnya dari CDN Pexels lalu mengunggahnya ke media
//   library (nama file `pexels-<id>.jpg`; yang sudah ada dipakai ulang). Unduhan gagal = pelatihan itu
//   dilewati dan dicatat, seed tetap jalan.
// - Hanya mengganti foto bawaan seed (foto tema, ilustrasi sampul, foto pool lama, foto dari daftar ini).
//   Sampul atau galeri yang diunggah admin tidak disentuh.
// - updatedById tidak diisi, sama seperti seed foto tema.
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { getDb } from "../src/lib/db";
import { RevalidateTag, revalidateTags } from "../src/lib/revalidate";
import { AuditAction, writeAudit } from "../src/services/audit";
import { uploadMedia } from "../src/services/media";
import { isLegacyPoolPhoto } from "./seed-manifest-gallery";
import { loadThemes, themeUploadName } from "./seed-data/themes";

const db = getDb();
const GALLERY_DIR = path.join(__dirname, "seed-data", "gallery");
const COVERS_DIR = path.join(__dirname, "seed-data", "covers");
const DOWNLOAD_WIDTH = 2400;
const DOWNLOAD_TIMEOUT_MS = 30_000;

const photoSchema = z.object({ pexelsId: z.number().int().positive(), alt: z.string().min(1).max(200) });
export const trainingPhotosSchema = z.object({
  source: z.object({ provider: z.literal("pexels"), license: z.string(), url: z.string() }),
  trainings: z.record(z.string(), z.object({ cover: photoSchema, gallery: z.array(photoSchema).length(4) })),
});
export type TrainingPhoto = z.infer<typeof photoSchema>;
export type TrainingPhotos = z.infer<typeof trainingPhotosSchema>;

export async function loadTrainingPhotos(): Promise<TrainingPhotos> {
  return trainingPhotosSchema.parse(JSON.parse(await readFile(path.join(GALLERY_DIR, "training-photos.json"), "utf8")));
}

export const pexelsUploadName = (photo: TrainingPhoto) => `pexels-${photo.pexelsId}.jpg`;
const isPexelsSeedPhoto = (name: string) => /^pexels-\d+\.jpg$/.test(name);

type Step = {
  id: string;
  slug: string;
  cover: TrainingPhoto | null;
  gallery: TrainingPhoto[] | null;
  previousCoverId: string | null;
  previousImageIds: string[];
};

export type TrainingPhotoPlan = { steps: Step[]; missing: string[]; kept: number };

// Rencana tanpa menulis apa pun: pelatihan yang sampul dan/atau galerinya masih foto bawaan seed dan
// belum sama dengan daftar.
export async function planTrainingPhotos(photos?: TrainingPhotos): Promise<TrainingPhotoPlan> {
  const list = photos ?? (await loadTrainingPhotos());
  const themes = loadThemes();
  const seedNames = new Set([
    ...themes.themes.flatMap((theme) => theme.photos.map((photo) => themeUploadName(photo.file))),
    ...themes.retired.map(themeUploadName),
    ...(await readdir(COVERS_DIR).catch(() => [] as string[])).filter((name) => name.endsWith(".jpg")),
    // Pool galeri administrative (seed-gallery.ts): dipakai bergiliran, jadi berulang antarpelatihan.
    ...(await readdir(GALLERY_DIR).catch(() => [] as string[])).filter((name) => /^administrative-\d+\.jpg$/.test(name)),
  ]);
  const isSeedImage = (name: string | null | undefined) =>
    !!name && (seedNames.has(name) || isPexelsSeedPhoto(name) || isLegacyPoolPhoto(name));

  const steps: Step[] = [];
  const missing: string[] = [];
  let kept = 0;
  for (const [slug, entry] of Object.entries(list.trainings)) {
    const row = await db.training.findFirst({
      where: { slug, deletedAt: null },
      select: {
        id: true,
        coverId: true,
        cover: { select: { originalName: true, deletedAt: true } },
        images: { orderBy: { order: "asc" }, select: { mediaId: true, media: { select: { originalName: true } } } },
      },
    });
    if (!row) {
      missing.push(slug);
      continue;
    }
    const coverName = row.cover && row.cover.deletedAt === null ? row.cover.originalName : null;
    const coverDone = coverName === pexelsUploadName(entry.cover);
    const coverFree = !coverDone && (!row.coverId || coverName === null || isSeedImage(coverName));
    const names = row.images.map((image) => image.media.originalName);
    const wanted = entry.gallery.map(pexelsUploadName);
    const galleryDone = names.length === wanted.length && names.every((name, index) => name === wanted[index]);
    const galleryFree = !galleryDone && names.every(isSeedImage);
    if (!coverFree && !galleryFree) {
      if (!coverDone || !galleryDone) kept += 1;
      continue;
    }
    steps.push({
      id: row.id,
      slug,
      cover: coverFree ? entry.cover : null,
      gallery: galleryFree ? entry.gallery : null,
      previousCoverId: row.coverId,
      previousImageIds: row.images.map((image) => image.mediaId),
    });
  }
  return { steps, missing, kept };
}

async function download(photo: TrainingPhoto): Promise<Uint8Array> {
  const url = `https://images.pexels.com/photos/${photo.pexelsId}/pexels-photo-${photo.pexelsId}.jpeg?auto=compress&cs=tinysrgb&w=${DOWNLOAD_WIDTH}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

// Media untuk foto: pakai yang sudah diunggah (nama file sama, belum di Sampah), atau unduh lalu unggah.
// Alt hanya diisi kalau masih kosong, supaya suntingan admin tetap.
async function ensureMedia(photo: TrainingPhoto, userId: string): Promise<{ id: string; uploaded: boolean }> {
  const name = pexelsUploadName(photo);
  const existing = await db.media.findFirst({ where: { originalName: name, deletedAt: null }, select: { id: true, alt: true } });
  if (existing) {
    if (!existing.alt) await db.media.update({ where: { id: existing.id }, data: { alt: photo.alt } });
    return { id: existing.id, uploaded: false };
  }
  const { created, failed } = await uploadMedia([{ name, data: await download(photo) }], { folder: null, userId, revalidate: false });
  if (failed.length > 0) throw new Error(failed[0].message);
  await db.media.update({ where: { id: created[0].id }, data: { alt: photo.alt } });
  return { id: created[0].id, uploaded: true };
}

export type TrainingPhotoResult = { trainings: number; uploaded: number; failed: string[]; missing: string[]; kept: number };

export async function applyTrainingPhotos(plan: TrainingPhotoPlan): Promise<TrainingPhotoResult> {
  const owner = await db.user.findFirstOrThrow({ orderBy: { createdAt: "asc" }, select: { id: true } });
  const failed: string[] = [];
  const done: Step[] = [];
  let uploaded = 0;
  for (const step of plan.steps) {
    try {
      const ids = new Map<number, string>();
      for (const photo of [...(step.cover ? [step.cover] : []), ...(step.gallery ?? [])]) {
        const media = await ensureMedia(photo, owner.id);
        ids.set(photo.pexelsId, media.id);
        if (media.uploaded) uploaded += 1;
      }
      const mediaId = (photo: TrainingPhoto) => ids.get(photo.pexelsId) as string;
      await db.$transaction(async (tx) => {
        const diff: { coverId?: { from: string | null; to: string }; imageIds?: { from: string[]; to: string[] } } = {};
        if (step.cover) {
          await tx.training.update({ where: { id: step.id }, data: { coverId: mediaId(step.cover) } });
          diff.coverId = { from: step.previousCoverId, to: mediaId(step.cover) };
        }
        if (step.gallery) {
          const imageIds = step.gallery.map(mediaId);
          await tx.trainingImage.deleteMany({ where: { trainingId: step.id } });
          await tx.trainingImage.createMany({
            data: imageIds.map((id, order) => ({ trainingId: step.id, mediaId: id, order })),
          });
          diff.imageIds = { from: step.previousImageIds, to: imageIds };
        }
        await writeAudit({ userId: owner.id, action: AuditAction.UPDATE, entity: "Training", entityId: step.id, diff }, tx);
      });
      done.push(step);
    } catch (error) {
      failed.push(`${step.slug} (${error instanceof Error ? error.message : String(error)})`);
    }
  }

  if (done.length > 0 && process.env.FE_REVALIDATE_URL && process.env.REVALIDATE_SECRET) {
    await revalidateTags([
      RevalidateTag.MEDIA,
      RevalidateTag.TRAININGS,
      RevalidateTag.CATEGORIES,
      RevalidateTag.HOME,
      ...done.map((step) => RevalidateTag.training(step.slug)),
    ]);
  }
  return { trainings: done.length, uploaded, failed, missing: plan.missing, kept: plan.kept };
}

// Untuk seed.ts: rencanakan lalu terapkan kalau ada yang perlu diubah.
export async function seedTrainingPhotos(): Promise<TrainingPhotoResult | "dilewati"> {
  const plan = await planTrainingPhotos();
  if (plan.steps.length === 0) return "dilewati";
  return applyTrainingPhotos(plan);
}
