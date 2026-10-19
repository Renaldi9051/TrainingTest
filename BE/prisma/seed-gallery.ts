// Galeri foto pelatihan dari seed-data/gallery/<kategori>-N.jpg (foto stok Unsplash, lisensi bebas).
// Untuk tiap pelatihan di kategori accounting & administrative yang galerinya masih kosong, dipasang
// 4 foto ke TrainingImage (dirotasi dari pool kategori); foto pertama jadi sampul hanya kalau sampulnya
// masih kosong. Idempotent: pelatihan yang sudah punya galeri dilewati, dan foto pool yang sudah diunggah
// (originalName sama) dipakai ulang, tidak diunggah lagi.
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { getDb } from "../src/lib/db";
import { uploadMedia } from "../src/services/media";

const db = getDb();

const GALLERY_DIR = path.join(__dirname, "seed-data", "gallery");
const CATEGORY_SLUGS = ["accounting", "administrative"] as const;
const GALLERY_SIZE = 4;
const ALT: Record<string, string> = {
  accounting: "Foto pelatihan accounting dan keuangan",
  administrative: "Foto pelatihan administrasi perkantoran",
};

export async function seedGallery(): Promise<number | "dilewati"> {
  const files = (await readdir(GALLERY_DIR).catch(() => [] as string[])).filter((name) => name.endsWith(".jpg"));
  if (files.length === 0) return "dilewati";

  const owner = await db.user.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } });
  if (!owner) return "dilewati";

  const poolFiles: Record<string, string[]> = {};
  for (const slug of CATEGORY_SLUGS) poolFiles[slug] = files.filter((name) => name.startsWith(`${slug}-`)).sort();

  // Unggah foto pool sekali; pakai ulang yang sudah ada (originalName sama).
  const existing = await db.media.findMany({ where: { originalName: { in: files } }, select: { id: true, originalName: true } });
  const idByName = new Map(existing.flatMap((media) => (media.originalName ? [[media.originalName, media.id] as const] : [])));
  const toUpload = files.filter((name) => !idByName.has(name));
  if (toUpload.length > 0) {
    const inputs = await Promise.all(
      toUpload.map(async (name) => ({ name, data: new Uint8Array(await readFile(path.join(GALLERY_DIR, name))) })),
    );
    const { created } = await uploadMedia(inputs, { folder: null, userId: owner.id, revalidate: false });
    for (const media of created) if (media.originalName) idByName.set(media.originalName, media.id);
  }

  let assigned = 0;
  const seen = new Set<string>();
  for (const slug of CATEGORY_SLUGS) {
    const pool = poolFiles[slug].flatMap((name) => (idByName.get(name) ? [idByName.get(name)!] : []));
    if (pool.length === 0) continue;
    await db.media.updateMany({ where: { id: { in: pool }, alt: null }, data: { alt: ALT[slug] } });

    const category = await db.category.findFirst({ where: { slug, deletedAt: null }, select: { id: true } });
    if (!category) continue;
    const trainings = await db.training.findMany({
      where: { deletedAt: null, categories: { some: { categoryId: category.id } } },
      select: { id: true, coverId: true, _count: { select: { images: true } } },
      orderBy: [{ publishedAt: "desc" }, { slug: "asc" }],
    });
    let i = 0;
    for (const training of trainings) {
      if (training._count.images === 0 && !seen.has(training.id)) {
        // Blok tanpa tumpang tindih: pelatihan ke-i memakai 4 foto berurutan [i*4 .. i*4+3].
        // Pool kategori berisi 24 foto (6 pelatihan x 4), jadi tiap pelatihan dapat 4 foto unik
        // dan tidak ada foto yang sama antar pelatihan dalam satu kategori.
        const start = i * GALLERY_SIZE;
        const pick = Array.from({ length: GALLERY_SIZE }, (_, k) => pool[(start + k) % pool.length]);
        await db.trainingImage.createMany({
          data: pick.map((mediaId, order) => ({ trainingId: training.id, mediaId, order })),
          skipDuplicates: true,
        });
        if (!training.coverId) await db.training.update({ where: { id: training.id }, data: { coverId: pick[0] } });
        seen.add(training.id);
        assigned += 1;
      }
      i += 1;
    }
  }
  return assigned;
}
