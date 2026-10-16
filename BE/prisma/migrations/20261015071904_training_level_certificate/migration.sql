-- CreateEnum
CREATE TYPE "TrainingLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

-- AlterTable
ALTER TABLE "Training" ADD COLUMN     "certificate" BOOLEAN,
ADD COLUMN     "level" "TrainingLevel";
