-- CreateEnum
CREATE TYPE "InquirySource" AS ENUM ('TRAINING_DETAIL', 'CONTACT');

-- AlterTable
ALTER TABLE "Inquiry" ADD COLUMN     "consentAt" TIMESTAMPTZ(3),
ADD COLUMN     "consentVersion" TEXT,
ADD COLUMN     "interest" TEXT,
ADD COLUMN     "source" "InquirySource" NOT NULL DEFAULT 'CONTACT';
