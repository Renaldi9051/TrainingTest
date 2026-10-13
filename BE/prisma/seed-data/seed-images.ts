// Pasang gambar placeholder (placeholder-image.ts) ke data contoh: gambar layanan dan galeri
// portofolio (2 per kegiatan). Sampul pelatihan memakai JPG contoh (seed-covers.ts). File lewat jalur
// upload biasa (WebP + varian di UPLOAD_DIR), tercatat di media library folder "contoh" dengan alt,
// jadi admin bisa mengganti atau menghapusnya. Hanya mengisi baris yang belum punya gambar.
import type { Prisma } from "../../src/generated/prisma/client";
import { getDb } from "../../src/lib/db";
import { uploadMedia } from "../../src/services/media";
import { placeholderPng } from "./placeholder-image";

export const PLACEHOLDER_FOLDER = "contoh";
export const PORTFOLIO_IMAGES_PER_ITEM = 2;

type Db = ReturnType<typeof getDb>;
type Spec = { name: string; alt: string; seed: number };

export type ImageTargets = {
  services: { id: string; title: string }[];
  portfolio: { id: string; title: string }[];
};

export type ImageSeedResult = { services: number; portfolio: number; media: number };

// Baris yang belum punya gambar (tidak termasuk Sampah).
export async function findImageTargets(db: Db = getDb()): Promise<ImageTargets> {
  const [services, portfolio] = await Promise.all([
    db.service.findMany({ where: { deletedAt: null, imageId: null }, orderBy: { order: "asc" }, select: { id: true, title: true } }),
    db.portfolioItem.findMany({ where: { deletedAt: null, images: { none: {} } }, orderBy: { order: "asc" }, select: { id: true, title: true } }),
  ]);
  return { services, portfolio };
}

// Jumlah Media yang akan dibuat untuk target ini (untuk dry run).
export function plannedMediaCount(targets: ImageTargets): number {
  return targets.services.length + targets.portfolio.length * PORTFOLIO_IMAGES_PER_ITEM;
}

// Buat Media dari spesifikasi (berurutan supaya memori sharp rendah), lalu isi alt-nya.
async function createMedia(db: Db, specs: Spec[], userId: string): Promise<string[]> {
  const ids: string[] = [];
  for (const spec of specs) {
    const { created, failed } = await uploadMedia([{ name: spec.name, data: await placeholderPng(spec.seed) }], {
      folder: PLACEHOLDER_FOLDER,
      userId,
      // Seed: FE belum tentu hidup; database baru belum punya cache. Skrip sinkronisasi merevalidasi sekali.
      revalidate: false,
    });
    if (failed.length > 0 || !created[0]) throw new Error(`Gambar placeholder gagal dibuat: ${spec.name} (${failed[0]?.message ?? "tanpa hasil"})`);
    await db.media.update({ where: { id: created[0].id }, data: { alt: spec.alt } });
    ids.push(created[0].id);
  }
  return ids;
}

// Seed angka stabil per jenis + urutan (gambar sama di setiap mesin dan setiap run).
const seedOf = (kind: number, index: number) => kind * 1000 + index + 1;

export async function seedPlaceholderImages(targets: ImageTargets, userId: string, db: Db = getDb()): Promise<ImageSeedResult> {
  const serviceIds = await createMedia(
    db,
    targets.services.map((service, index) => ({
      name: `contoh-layanan-${index + 1}.png`,
      alt: `Ilustrasi placeholder layanan ${service.title}`,
      seed: seedOf(1, index),
    })),
    userId,
  );
  for (const [index, service] of targets.services.entries()) {
    await db.service.update({ where: { id: service.id }, data: { imageId: serviceIds[index] } });
  }

  let media = serviceIds.length;
  const galleryRows: Prisma.PortfolioImageCreateManyInput[] = [];
  for (const [index, item] of targets.portfolio.entries()) {
    const ids = await createMedia(
      db,
      Array.from({ length: PORTFOLIO_IMAGES_PER_ITEM }, (_, image) => ({
        name: `contoh-portofolio-${index + 1}-${image + 1}.png`,
        alt: `Ilustrasi placeholder dokumentasi ${item.title} (${image + 1})`,
        seed: seedOf(2, index * PORTFOLIO_IMAGES_PER_ITEM + image),
      })),
      userId,
    );
    media += ids.length;
    ids.forEach((mediaId, order) => galleryRows.push({ portfolioItemId: item.id, mediaId, order }));
  }
  if (galleryRows.length > 0) await db.portfolioImage.createMany({ data: galleryRows });

  return { services: targets.services.length, portfolio: targets.portfolio.length, media };
}
