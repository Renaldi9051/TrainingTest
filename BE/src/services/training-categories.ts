import type { Prisma } from "@/generated/prisma/client";

// Satu pelatihan boleh tertaut ke beberapa kategori (seperti situs referensi, keputusan pemilik
// 11 Nov 2026). Salah satunya kategori utama (`TrainingCategory.isPrimary`): label kartu, sampul
// cadangan, dan breadcrumb. Di API admin kategori utama = elemen pertama `categoryIds`.

type Ranked = { isPrimary?: boolean; order: number };

// Kategori utama dulu, lalu urutan admin. Tanpa penanda (data lama) = urutan admin saja.
export function byPrimaryThenOrder(a: Ranked, b: Ranked): number {
  return Number(b.isPrimary ?? false) - Number(a.isPrimary ?? false) || a.order - b.order;
}

// Link yang dibaca dari DB -> kategori aktif terurut, penanda isPrimary ikut di tiap kategori.
export function orderedCategories<C extends { order: number; deletedAt: Date | null }>(
  links: { isPrimary: boolean; category: C }[],
): (C & { isPrimary: boolean })[] {
  return links
    .filter((link) => link.category.deletedAt === null)
    .map((link) => ({ ...link.category, isPrimary: link.isPrimary }))
    .sort(byPrimaryThenOrder);
}

// Data link dari `categoryIds` (elemen pertama = kategori utama).
export function categoryLinks(categoryIds: string[]): { categoryId: string; isPrimary: boolean }[] {
  return categoryIds.map((categoryId, index) => ({ categoryId, isPrimary: index === 0 }));
}

type LinkTx = Pick<Prisma.TransactionClient, "trainingCategory">;

// Jadikan `categoryId` kategori utama pelatihan-pelatihan ini. Kategori utama lama dilepas (pindah
// kategori), kategori tambahan lain tetap.
export async function setPrimaryCategory(tx: LinkTx, trainingIds: string[], categoryId: string): Promise<void> {
  if (trainingIds.length === 0) return;
  await tx.trainingCategory.deleteMany({
    where: { trainingId: { in: trainingIds }, isPrimary: true, categoryId: { not: categoryId } },
  });
  await tx.trainingCategory.updateMany({
    where: { trainingId: { in: trainingIds }, categoryId },
    data: { isPrimary: true },
  });
  await tx.trainingCategory.createMany({
    data: trainingIds.map((trainingId) => ({ trainingId, categoryId, isPrimary: true })),
    skipDuplicates: true,
  });
}

// Pelatihan yang kehilangan kategori utama (kategorinya dihapus/digabung): kategori aktif dengan
// urutan admin terendah jadi kategori utama. Pelatihan yang masih punya kategori utama tidak disentuh.
export async function repairPrimaryCategories(tx: LinkTx, trainingIds: string[]): Promise<void> {
  if (trainingIds.length === 0) return;
  const links = await tx.trainingCategory.findMany({
    where: { trainingId: { in: trainingIds } },
    select: {
      trainingId: true,
      categoryId: true,
      isPrimary: true,
      category: { select: { order: true, slug: true, deletedAt: true } },
    },
  });
  const byTraining = new Map<string, typeof links>();
  for (const link of links) byTraining.set(link.trainingId, [...(byTraining.get(link.trainingId) ?? []), link]);
  for (const [trainingId, items] of byTraining) {
    if (items.some((item) => item.isPrimary)) continue;
    const next = [...items].sort(
      (a, b) =>
        Number(a.category.deletedAt !== null) - Number(b.category.deletedAt !== null) ||
        a.category.order - b.category.order ||
        a.category.slug.localeCompare(b.category.slug),
    )[0];
    await tx.trainingCategory.update({
      where: { trainingId_categoryId: { trainingId, categoryId: next.categoryId } },
      data: { isPrimary: true },
    });
  }
}
