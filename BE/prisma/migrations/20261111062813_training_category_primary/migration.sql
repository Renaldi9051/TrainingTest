-- AlterTable
ALTER TABLE "TrainingCategory" ADD COLUMN     "isPrimary" BOOLEAN NOT NULL DEFAULT false;

-- Kategori utama awal = label yang tampil sekarang: kategori aktif dengan urutan admin terendah.
UPDATE "TrainingCategory" tc
SET "isPrimary" = true
FROM (
  SELECT DISTINCT ON (l."trainingId") l."trainingId", l."categoryId"
  FROM "TrainingCategory" l
  JOIN "Category" c ON c."id" = l."categoryId"
  ORDER BY l."trainingId", (c."deletedAt" IS NOT NULL), c."order", c."slug"
) p
WHERE tc."trainingId" = p."trainingId" AND tc."categoryId" = p."categoryId";
