import type { Prisma } from "../src/generated/prisma/client";
import { getDb } from "../src/lib/db";
import { RevalidateTag, revalidateTags } from "../src/lib/revalidate";
import { sampleArticles } from "./seed-data/articles";

// Artikel contoh (seed-data/articles.ts), langsung tayang. Aman diulang dan tidak menimpa data:
// - Artikel dibuat hanya kalau slug-nya belum pernah ada (termasuk di Sampah), jadi artikel yang
//   dihapus atau diubah slug-nya oleh admin tidak muncul lagi.
// - Kategori artikel dipakai kalau sudah ada (aktif); dibuat hanya kalau slug-nya belum pernah ada.
//   Kategori yang dihapus admin tidak dibuat ulang (artikel tanpa kategori).
// - Sampul: gambar kategori pelatihan yang disebut (media aktif dengan alt), selain itu tanpa sampul.
export async function seedArticles(now = new Date()): Promise<{ created: number; skipped: number }> {
  const db = getDb();
  let created = 0;
  // Artikel kedua lebih baru (urutan di /artikel sama dengan contoh di lokal).
  const lastIndex = sampleArticles.length - 1;
  for (const [index, article] of sampleArticles.entries()) {
    if ((await db.article.count({ where: { slug: article.slug } })) > 0) continue;

    const categoryId = await ensureCategory(article.category);
    const trainingCategory = await db.category.findFirst({
      where: { slug: article.coverFromTrainingCategory, deletedAt: null },
      select: { image: { select: { id: true, alt: true, mime: true, deletedAt: true } } },
    });
    const image = trainingCategory?.image;
    const coverId = image && image.deletedAt === null && image.alt && image.mime.startsWith("image/") ? image.id : null;
    const publishedAt = new Date(now.getTime() - (lastIndex - index + 1) * 30 * 60 * 1000);

    await db.article.create({
      data: {
        slug: article.slug,
        title: article.title,
        excerpt: article.excerpt,
        body: article.body as Prisma.InputJsonValue,
        authorName: article.authorName,
        categoryId,
        coverId,
        status: "PUBLISHED",
        publishedAt,
        // Sudah lewat waktunya: tidak perlu menunggu scheduler.
        publishRevalidatedAt: now,
        seo: { title: "", description: "", ogImageId: null },
      },
    });
    created += 1;
  }

  if (created > 0 && process.env.FE_REVALIDATE_URL && process.env.REVALIDATE_SECRET) {
    await revalidateTags([RevalidateTag.ARTICLES, RevalidateTag.HOME]);
  }
  return { created, skipped: sampleArticles.length - created };
}

async function ensureCategory(category: { slug: string; name: string }): Promise<string | null> {
  const db = getDb();
  const active = await db.articleCategory.findFirst({ where: { slug: category.slug, deletedAt: null }, select: { id: true } });
  if (active) return active.id;
  if ((await db.articleCategory.count({ where: { slug: category.slug } })) > 0) return null;
  const last = await db.articleCategory.findFirst({
    where: { deletedAt: null },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  const row = await db.articleCategory.create({
    data: { slug: category.slug, name: category.name, order: (last?.order ?? -1) + 1 },
    select: { id: true },
  });
  return row.id;
}
