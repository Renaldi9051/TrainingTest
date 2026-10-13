// Cover pelatihan contoh: file seed-data/covers/<slug-pelatihan>.jpg dipasang ke pelatihan dengan slug yang sama.
// Hanya mengisi pelatihan yang belum punya cover. Kalau media dengan nama file itu sudah pernah diunggah
// (termasuk yang di Sampah), pelatihannya dilewati supaya cover yang dilepas admin tidak muncul lagi.
// seed.ts memanggilnya hanya saat katalog contoh baru dibuat; database yang sudah berisi memakai
// `npm run db:sync-content -- --only=images` (dry run dulu). Ganti gambar: timpa file .jpg dengan
// nama sama (berlaku untuk database baru), atau ubah langsung di panel admin.
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { getDb } from "../src/lib/db";
import { uploadMedia } from "../src/services/media";

const db = getDb();

const COVER_DIR = path.join(__dirname, "seed-data", "covers");
const BATCH_SIZE = 10;

export type CoverTarget = { id: string; slug: string; title: string; file: string };

// Pelatihan yang akan diberi cover (tanpa mengubah apa pun).
export async function findCoverTargets(): Promise<CoverTarget[]> {
  const files = (await readdir(COVER_DIR).catch(() => [] as string[])).filter((name) => name.endsWith(".jpg"));
  if (files.length === 0) return [];
  const bySlug = new Map(files.map((name) => [name.slice(0, -".jpg".length), name]));
  const trainings = await db.training.findMany({
    where: { deletedAt: null, coverId: null, slug: { in: [...bySlug.keys()] } },
    select: { id: true, slug: true, title: true },
  });
  const uploaded = await db.media.findMany({ where: { originalName: { in: files } }, select: { originalName: true } });
  const done = new Set(uploaded.map((media) => media.originalName));
  return trainings.flatMap((training) => {
    const file = bySlug.get(training.slug);
    return file && !done.has(file) ? [{ ...training, file }] : [];
  });
}

export async function seedCovers(targets?: CoverTarget[]): Promise<number | "dilewati"> {
  const todo = targets ?? (await findCoverTargets());
  if (todo.length === 0) return "dilewati";

  const owner = await db.user.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } });
  if (!owner) return "dilewati";

  let attached = 0;
  for (let i = 0; i < todo.length; i += BATCH_SIZE) {
    const batch = todo.slice(i, i + BATCH_SIZE);
    const inputs = await Promise.all(
      batch.map(async (training) => ({ name: training.file, data: new Uint8Array(await readFile(path.join(COVER_DIR, training.file))) })),
    );
    // Revalidate sekali oleh pemanggil (skrip sinkronisasi); database baru belum punya cache.
    const { created } = await uploadMedia(inputs, { folder: null, userId: owner.id, revalidate: false });
    const idByName = new Map(created.map((media) => [media.originalName, media.id]));

    for (const training of batch) {
      const mediaId = idByName.get(training.file);
      if (!mediaId) continue;
      await db.media.update({ where: { id: mediaId }, data: { alt: `Cover pelatihan ${training.title}`.slice(0, 200) } });
      await db.training.update({ where: { id: training.id }, data: { coverId: mediaId } });
      attached += 1;
    }
  }
  return attached;
}
