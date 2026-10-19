// Skrip sekali jalan: memasang foto dari prisma/seed-data/gallery/manifest.json ke database dev.
//
//   npm run db:seed:gallery            # dry run: tampilkan rencana, tidak mengubah apa pun
//   npm run db:seed:gallery -- --apply # unggah ke media library, pasang, lalu revalidate FE
//
// - Gambar kategori diganti dengan foto di manifest (permintaan pemilik, 19 Okt 2026). Media lama tidak
//   dihapus, tetap di media library.
// - Sampul dan galeri pelatihan hanya diisi kalau masih kosong, supaya pilihan admin tidak tertimpa.
// - Foto yang sudah pernah diunggah (nama file asli sama, belum di Sampah) dipakai ulang, jadi skrip
//   aman dijalankan ulang.
// Semua foto berlisensi CC0 (sumber per foto dicatat di manifest). Menolak jalan selain di training_dev
// atau training_e2e.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { getDb } from "../src/lib/db";
import { databaseName } from "../src/lib/env";
import { RevalidateTag, revalidateTags } from "../src/lib/revalidate";
import { AuditAction, writeAudit } from "../src/services/audit";
import { uploadMedia } from "../src/services/media";

const ALLOWED_DATABASES = new Set(["training_dev", "training_e2e"]);
const APPLY = process.argv.includes("--apply");
const GALLERY_DIR = path.join(__dirname, "..", "prisma", "seed-data", "gallery");

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

type CategoryStep = { id: string; slug: string; name: string; photo: Photo; currentName: string | null };
type TrainingStep = {
  id: string;
  slug: string;
  title: string;
  cover: Photo | null;
  gallery: Photo[] | null;
  skipped: string[];
};

async function plan(manifest: z.infer<typeof manifestSchema>) {
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
  for (const [slug, entry] of Object.entries(manifest.trainings)) {
    const row = await db.training.findFirst({
      where: { slug, deletedAt: null },
      select: { id: true, title: true, coverId: true, _count: { select: { images: true } } },
    });
    if (!row) {
      missing.push(`pelatihan ${slug}`);
      continue;
    }
    const skipped = [
      row.coverId ? "sampul sudah ada" : null,
      row._count.images > 0 ? `galeri sudah berisi ${row._count.images} foto` : null,
    ].filter((value): value is string => value !== null);
    const step = {
      id: row.id,
      slug,
      title: row.title,
      cover: row.coverId ? null : entry.cover,
      gallery: row._count.images > 0 ? null : entry.gallery,
      skipped,
    };
    if (step.cover || step.gallery) trainings.push(step);
    else console.info(`  [tetap] ${slug}: ${skipped.join(", ")}`);
  }
  return { categories, trainings, missing };
}

// Unggah foto yang belum ada di media library; kembalikan peta nama file -> id media.
async function ensureMedia(photos: Photo[], userId: string): Promise<Map<string, string>> {
  const names = photos.map(uploadName);
  const existing = await db.media.findMany({
    where: { originalName: { in: names }, deletedAt: null },
    select: { id: true, originalName: true },
  });
  const ids = new Map(existing.map((media) => [media.originalName as string, media.id]));
  const todo = photos.filter((photo) => !ids.has(uploadName(photo)));
  for (const photo of todo) {
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
  console.info(`Media: ${todo.length} diunggah, ${photos.length - todo.length} dipakai ulang.`);
  return ids;
}

async function apply(steps: Awaited<ReturnType<typeof plan>>) {
  const owner = await db.user.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } });
  if (!owner) throw new Error("Belum ada admin. Jalankan seed dulu.");

  const photos = [
    ...steps.categories.map((step) => step.photo),
    ...steps.trainings.flatMap((step) => [...(step.cover ? [step.cover] : []), ...(step.gallery ?? [])]),
  ];
  const ids = await ensureMedia(photos, owner.id);
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
      const diff: { coverId?: { from: null; to: string }; imageIds?: { from: string[]; to: string[] } } = {};
      if (step.cover) {
        await tx.training.update({ where: { id: step.id }, data: { coverId: mediaId(step.cover), updatedById: owner.id } });
        diff.coverId = { from: null, to: mediaId(step.cover) };
      }
      if (step.gallery) {
        const imageIds = step.gallery.map(mediaId);
        await tx.trainingImage.createMany({
          data: imageIds.map((id, order) => ({ trainingId: step.id, mediaId: id, order })),
        });
        diff.imageIds = { from: [], to: imageIds };
      }
      await writeAudit(
        { userId: owner.id, action: AuditAction.UPDATE, entity: "Training", entityId: step.id, diff },
        tx,
      );
    }
  });

  const ok = await revalidateTags([
    RevalidateTag.MEDIA,
    RevalidateTag.CATEGORIES,
    RevalidateTag.TRAININGS,
    ...steps.categories.map((step) => RevalidateTag.category(step.slug)),
    ...steps.trainings.map((step) => RevalidateTag.training(step.slug)),
  ]);
  console.info(ok ? "Cache FE direvalidasi." : "Revalidate FE gagal (FE tidak menyala?). Data tetap tersimpan.");
}

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  const name = url ? databaseName(url) : "";
  if (!ALLOWED_DATABASES.has(name)) throw new Error(`Menolak jalan: database "${name}" bukan training_dev.`);

  const manifest = manifestSchema.parse(JSON.parse(await readFile(path.join(GALLERY_DIR, "manifest.json"), "utf8")));
  console.info(`${APPLY ? "Menjalankan" : "Rencana (dry run, belum ada yang diubah)"} foto pelatihan di ${name}:\n`);
  const steps = await plan(manifest);

  for (const step of steps.categories) {
    console.info(`  [ubah] kategori ${step.name}: gambar ${step.currentName ?? "(kosong)"} -> ${step.photo.file}`);
  }
  for (const step of steps.trainings) {
    const parts = [
      step.cover ? "sampul" : null,
      step.gallery ? `galeri ${step.gallery.length} foto` : null,
      ...step.skipped.map((reason) => `dilewati: ${reason}`),
    ].filter(Boolean);
    console.info(`  [isi] ${step.title}: ${parts.join(", ")}`);
  }
  for (const item of steps.missing) console.info(`  [tidak ditemukan] ${item}`);

  if (steps.categories.length === 0 && steps.trainings.length === 0) {
    console.info("\nTidak ada yang perlu diubah.");
    return;
  }
  if (!APPLY) {
    console.info("\nJalankan dengan --apply untuk menerapkan.");
    return;
  }
  await apply(steps);
  console.info("Selesai.");
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error && error.message ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
