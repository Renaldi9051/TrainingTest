import { randomUUID } from "node:crypto";
import type { Prisma } from "../src/generated/prisma/client";
import { getDb } from "../src/lib/db";
import { RevalidateTag, revalidateTags } from "../src/lib/revalidate";

export const GALLERY_PAGE_SLUG = "galeri";
const GALLERY_PHOTOS = 12;

// Halaman /galeri (blok Galeri foto) + menu header "Galeri" (permintaan pemilik 10 Nov 2026). Aman
// diulang dan tidak menimpa data:
// - Halaman dibuat hanya kalau slug galeri belum pernah ada (termasuk di Sampah). Foto: foto kegiatan
//   ber-alt yang dipakai galeri pelatihan (bukan logo), maksimal 12, alt unik.
// - Database baru (menu masih kosong sebelum seed): halaman langsung tayang dan menu "Galeri" disisipkan
//   setelah menu Artikel. Database yang sudah berisi (mis. produksi): halaman dibuat sebagai DRAFT tanpa
//   menu, supaya pemilik memeriksa fotonya dan menayangkan sendiri lewat admin.
export async function seedGalleryPage(
  publishedAt: Date,
  freshDatabase: boolean,
): Promise<{ page: "published" | "draft" | "exists" | "no-photos"; menu: "created" | "exists" | "skipped" }> {
  const db = getDb();
  if ((await db.page.count({ where: { slug: GALLERY_PAGE_SLUG } })) > 0) return { page: "exists", menu: "skipped" };

  const candidates = await db.media.findMany({
    where: {
      deletedAt: null,
      mime: { startsWith: "image/" },
      alt: { not: null },
      width: { gte: 1000 },
      trainingImages: { some: {} },
    },
    select: { id: true, alt: true },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: 200,
  });
  const photos = pickGalleryPhotos(candidates, GALLERY_PHOTOS);
  if (photos.length < 2) return { page: "no-photos", menu: "skipped" };

  await db.page.create({
    data: {
      kind: "STANDARD",
      slug: GALLERY_PAGE_SLUG,
      title: "Galeri",
      status: freshDatabase ? "PUBLISHED" : "DRAFT",
      publishedAt: freshDatabase ? publishedAt : null,
      blocks: [
        {
          id: randomUUID(),
          type: "GALLERY",
          eyebrow: "Galeri",
          heading: "Dokumentasi kegiatan",
          intro: "Suasana kelas, diskusi, dan praktik dari pelatihan yang kami selenggarakan.",
          images: photos.map((id) => ({ mediaId: id })),
        },
      ] as Prisma.InputJsonValue,
      seo: { title: "", description: "", ogImageId: null },
    },
  });

  let menu: "created" | "exists" | "skipped" = "skipped";
  if (freshDatabase) {
    const href = `/${GALLERY_PAGE_SLUG}`;
    if ((await db.navItem.count({ where: { href } })) > 0) {
      menu = "exists";
    } else {
      // Database baru: menu header hasil seed ini sendiri, jadi urutan boleh digeser untuk menyisipkan.
      const article = await db.navItem.findFirst({
        where: { location: "HEADER", parentId: null, deletedAt: null, href: "/artikel" },
        select: { order: true },
      });
      const last = await db.navItem.findFirst({
        where: { location: "HEADER", parentId: null, deletedAt: null },
        orderBy: { order: "desc" },
        select: { order: true },
      });
      const order = article ? article.order + 1 : (last?.order ?? -1) + 1;
      if (article) {
        await db.navItem.updateMany({
          where: { location: "HEADER", parentId: null, order: { gte: order } },
          data: { order: { increment: 1 } },
        });
      }
      await db.navItem.create({ data: { location: "HEADER", label: "Galeri", href, order } });
      menu = "created";
    }
  }

  if (process.env.FE_REVALIDATE_URL && process.env.REVALIDATE_SECRET) {
    await revalidateTags([RevalidateTag.NAV, RevalidateTag.PAGES, RevalidateTag.page(GALLERY_PAGE_SLUG)]);
  }
  return { page: freshDatabase ? "published" : "draft", menu };
}

// Id media untuk galeri: urutan dipertahankan, alt kosong dilewati, satu foto per alt (foto yang sama
// sering diunggah ulang dengan alt yang sama).
export function pickGalleryPhotos(rows: { id: string; alt: string | null }[], max: number): string[] {
  const seen = new Set<string>();
  const picked: string[] = [];
  for (const row of rows) {
    const alt = row.alt?.trim().toLowerCase();
    if (!alt || seen.has(alt)) continue;
    seen.add(alt);
    picked.push(row.id);
    if (picked.length >= max) break;
  }
  return picked;
}
