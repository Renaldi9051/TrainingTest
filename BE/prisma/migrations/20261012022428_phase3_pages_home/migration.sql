-- CreateEnum
CREATE TYPE "PageKind" AS ENUM ('STANDARD', 'PROFILE');

-- AlterTable
ALTER TABLE "Page" ADD COLUMN     "kind" "PageKind" NOT NULL DEFAULT 'STANDARD';

-- AlterTable
ALTER TABLE "PortfolioItem" ADD COLUMN     "order" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "PortfolioItem_order_idx" ON "PortfolioItem"("order");

-- Partial unique index (ditulis manual; dideklarasikan juga di schema.prisma dengan predikat yang
-- sama persis seperti yang disimpan Postgres, supaya migrate dev tidak melihat drift).

-- HERO dan CTA masing-masing maksimal satu di antara section yang belum dihapus.
CREATE UNIQUE INDEX "HomeSection_single_type_key" ON "HomeSection"("type")
  WHERE "type" IN ('HERO', 'CTA') AND "deletedAt" IS NULL;

-- Hanya satu halaman sistem PROFILE (tidak bisa dihapus, jadi tanpa filter deletedAt).
CREATE UNIQUE INDEX "Page_profile_key" ON "Page"("kind") WHERE "kind" = 'PROFILE';
