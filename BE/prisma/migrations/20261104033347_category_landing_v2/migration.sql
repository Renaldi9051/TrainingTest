-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "audience" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "audienceSource" TEXT NOT NULL DEFAULT 'manual',
ADD COLUMN     "coverAlt" TEXT,
ADD COLUMN     "summary" TEXT;

-- CreateTable
CREATE TABLE "CategoryMedia" (
    "categoryId" UUID NOT NULL,
    "mediaId" UUID NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "alt" TEXT,
    "caption" TEXT,

    CONSTRAINT "CategoryMedia_pkey" PRIMARY KEY ("categoryId","mediaId")
);

-- CreateIndex
CREATE INDEX "CategoryMedia_categoryId_order_idx" ON "CategoryMedia"("categoryId", "order");

-- CreateIndex
CREATE INDEX "CategoryMedia_mediaId_idx" ON "CategoryMedia"("mediaId");

-- AddForeignKey
ALTER TABLE "CategoryMedia" ADD CONSTRAINT "CategoryMedia_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryMedia" ADD CONSTRAINT "CategoryMedia_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE CASCADE ON UPDATE CASCADE;
