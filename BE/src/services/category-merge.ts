import { getDb } from "@/lib/db";
import { HttpError } from "@/lib/http";
import { revalidateEntity } from "@/lib/revalidate-map";
import { CATEGORY_KEYWORDS_MAX, type CategoryMergeInput } from "@/lib/validators/category";
import { AuditAction, writeAudit } from "@/services/audit";
import { categoryNavHrefs, type CategoryDto, findActiveCategory, getCategory } from "@/services/category";
import { publicPath, recordSlugRedirect } from "@/services/redirect";

export type CategoryMergeResult = { target: CategoryDto; movedTrainings: number };

// Gabungkan kategori sumber ke tujuan (kategori kembar):
// - tautan pelatihan pindah ke tujuan (tanpa duplikat); pelatihan aktif ditandai diubah admin supaya
//   seed katalog referensi berikutnya tidak mengembalikan tautannya;
// - kata kunci digabung, unggulan ikut kalau sumber unggulan;
// - sumber masuk Sampah dan URL-nya di-redirect 301 ke tujuan;
// - item menu ke sumber diarahkan ke tujuan, atau dipindah ke Sampah kalau di grup menu yang sama
//   sudah ada item ke tujuan.
// Memulihkan sumber dari Sampah tidak mengembalikan tautan pelatihannya.
export async function mergeCategory(
  sourceId: string,
  input: CategoryMergeInput,
  userId: string,
): Promise<CategoryMergeResult> {
  if (sourceId === input.targetId) {
    throw new HttpError(422, "VALIDATION_ERROR", "Kategori tujuan harus berbeda.", {
      targetId: ["Pilih kategori lain sebagai tujuan."],
    });
  }
  const source = await findActiveCategory(sourceId);
  const target = await findActiveCategory(input.targetId).catch((error: unknown) => {
    if (error instanceof HttpError && error.status === 404) {
      throw new HttpError(422, "VALIDATION_ERROR", "Kategori tujuan tidak ditemukan.", {
        targetId: ["Kategori tujuan tidak ditemukan atau sudah dihapus."],
      });
    }
    throw error;
  });

  const db = getDb();
  const links = await db.trainingCategory.findMany({
    where: { categoryId: sourceId },
    select: { trainingId: true, training: { select: { slug: true, deletedAt: true } } },
  });
  const activeTrainings = links.filter((link) => link.training.deletedAt === null);
  const keywords = mergeKeywords(target.keywords, source.keywords);
  const now = new Date();

  const navChanged = await db.$transaction(async (tx) => {
    if (links.length > 0) {
      await tx.trainingCategory.createMany({
        data: links.map((link) => ({ trainingId: link.trainingId, categoryId: target.id })),
        skipDuplicates: true,
      });
      await tx.trainingCategory.deleteMany({ where: { categoryId: sourceId } });
    }
    if (activeTrainings.length > 0) {
      await tx.training.updateMany({
        where: { id: { in: activeTrainings.map((link) => link.trainingId) } },
        data: { updatedById: userId },
      });
    }
    await tx.category.update({
      where: { id: target.id },
      data: { keywords, featured: target.featured || source.featured, updatedById: userId },
    });
    await tx.category.update({ where: { id: sourceId }, data: { deletedAt: now, updatedById: userId } });

    // Item menu ke sumber: arahkan ke tujuan, kecuali grup menunya sudah punya item ke tujuan.
    const navItems = await tx.navItem.findMany({
      where: { href: { in: categoryNavHrefs(source.slug) }, deletedAt: null },
      select: { id: true, location: true, parentId: true, label: true, href: true },
    });
    const targetHrefs = categoryNavHrefs(target.slug);
    const navRetargeted: string[] = [];
    const navRemoved: string[] = [];
    for (const item of navItems) {
      const duplicate = await tx.navItem.findFirst({
        where: { location: item.location, parentId: item.parentId, href: { in: targetHrefs }, deletedAt: null },
        select: { id: true },
      });
      if (duplicate) {
        await tx.navItem.updateMany({
          where: { OR: [{ id: item.id }, { parentId: item.id }], deletedAt: null },
          data: { deletedAt: now, updatedById: userId },
        });
        navRemoved.push(item.id);
      } else {
        await tx.navItem.update({
          where: { id: item.id },
          data: {
            href: item.href === publicPath.category(source.slug) ? publicPath.category(target.slug) : targetHrefs[1],
            ...(item.label === source.name ? { label: target.name } : {}),
            updatedById: userId,
          },
        });
        navRetargeted.push(item.id);
      }
    }

    await recordSlugRedirect(tx, {
      from: publicPath.category(source.slug),
      to: publicPath.category(target.slug),
      userId,
      reason: "kategori digabung",
    });
    await writeAudit(
      {
        userId,
        action: AuditAction.DELETE,
        entity: "Category",
        entityId: sourceId,
        diff: { slug: source.slug, mergedInto: { id: target.id, slug: target.slug } },
      },
      tx,
    );
    await writeAudit(
      {
        userId,
        action: AuditAction.UPDATE,
        entity: "Category",
        entityId: target.id,
        diff: {
          mergedFrom: { id: sourceId, slug: source.slug },
          movedTrainings: links.map((link) => link.trainingId),
          ...(keywords.length !== target.keywords.length ? { keywords: { from: target.keywords, to: keywords } } : {}),
          ...(navRetargeted.length > 0 ? { retargetedNavItems: navRetargeted } : {}),
          ...(navRemoved.length > 0 ? { removedNavItems: navRemoved } : {}),
        },
      },
      tx,
    );
    return navItems.length > 0;
  });

  await revalidateEntity([
    { entity: "Category", slugs: [target.slug, source.slug] },
    ...(activeTrainings.length > 0
      ? [{ entity: "Training" as const, slugs: activeTrainings.map((link) => link.training.slug) }]
      : []),
    ...(navChanged ? [{ entity: "Nav" as const }] : []),
  ]);
  return { target: await getCategory(target.id), movedTrainings: links.length };
}

// Gabungan kata kunci tujuan + sumber tanpa duplikat (abaikan huruf besar/kecil), maksimal batas.
export function mergeKeywords(target: readonly string[], source: readonly string[]): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const keyword of [...target, ...source]) {
    const key = keyword.toLocaleLowerCase("id-ID");
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(keyword);
  }
  return merged.slice(0, CATEGORY_KEYWORDS_MAX);
}
