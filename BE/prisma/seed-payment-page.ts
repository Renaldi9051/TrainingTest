import type { Prisma } from "../src/generated/prisma/client";
import { getDb } from "../src/lib/db";
import { RevalidateTag, revalidateTags } from "../src/lib/revalidate";
import { buildPaymentPage } from "./seed-data/build";

const db = getDb();

// Halaman pembayaran + menu header "Pembayaran". Keputusan pemilik (19 Okt 2026): langsung tayang dengan
// rekening contoh [ISI], diganti lewat admin setelah deploy.
// - Halaman dibuat tayang hanya kalau slug-nya belum pernah ada (termasuk di Sampah), supaya halaman yang
//   dihapus admin tidak muncul lagi. Draft dari seed sebelumnya yang belum disentuh admin (updatedById
//   kosong) ikut ditayangkan.
// - Menu ditambah di akhir menu header hanya kalau belum pernah ada menu ke /pembayaran (termasuk di Sampah).
export async function seedPaymentPage(publishedAt: Date): Promise<{ page: "created" | "published" | "exists"; menu: "created" | "exists" }> {
  const page = buildPaymentPage();
  const href = `/${page.slug}`;
  let pageResult: "created" | "published" | "exists" = "exists";
  if ((await db.page.count({ where: { slug: page.slug } })) === 0) {
    await db.page.create({
      data: {
        kind: "STANDARD",
        slug: page.slug,
        title: page.title,
        status: "PUBLISHED",
        publishedAt,
        blocks: page.blocks as Prisma.InputJsonValue,
        seo: { title: "", description: "", ogImageId: null },
      },
    });
    pageResult = "created";
  } else {
    const published = await db.page.updateMany({
      where: { slug: page.slug, status: "DRAFT", deletedAt: null, updatedById: null },
      data: { status: "PUBLISHED", publishedAt },
    });
    if (published.count > 0) pageResult = "published";
  }

  let menuResult: "created" | "exists" = "exists";
  if ((await db.navItem.count({ where: { href } })) === 0) {
    const last = await db.navItem.findFirst({
      where: { location: "HEADER", parentId: null, deletedAt: null },
      orderBy: { order: "desc" },
      select: { order: true },
    });
    await db.navItem.create({ data: { location: "HEADER", label: page.title, href, order: (last?.order ?? -1) + 1 } });
    menuResult = "created";
  }

  if ((pageResult !== "exists" || menuResult === "created") && process.env.FE_REVALIDATE_URL && process.env.REVALIDATE_SECRET) {
    await revalidateTags([RevalidateTag.NAV, RevalidateTag.PAGES, RevalidateTag.page(page.slug)]);
  }
  return { page: pageResult, menu: menuResult };
}
