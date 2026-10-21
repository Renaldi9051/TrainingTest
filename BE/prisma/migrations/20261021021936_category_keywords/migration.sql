-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[];
