-- CreateTable
CREATE TABLE "TrainingImage" (
    "trainingId" UUID NOT NULL,
    "mediaId" UUID NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TrainingImage_pkey" PRIMARY KEY ("trainingId","mediaId")
);

-- CreateIndex
CREATE INDEX "TrainingImage_trainingId_order_idx" ON "TrainingImage"("trainingId", "order");

-- CreateIndex
CREATE INDEX "TrainingImage_mediaId_idx" ON "TrainingImage"("mediaId");

-- AddForeignKey
ALTER TABLE "TrainingImage" ADD CONSTRAINT "TrainingImage_trainingId_fkey" FOREIGN KEY ("trainingId") REFERENCES "Training"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingImage" ADD CONSTRAINT "TrainingImage_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE CASCADE ON UPDATE CASCADE;
