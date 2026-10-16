-- CreateEnum
CREATE TYPE "PortfolioActivityType" AS ENUM ('FIELD', 'CLASSROOM', 'CERTIFICATION', 'OUTBOUND');

-- AlterTable
ALTER TABLE "MarketingContact" ADD COLUMN     "area" TEXT;

-- AlterTable
ALTER TABLE "PortfolioItem" ADD COLUMN     "activityType" "PortfolioActivityType";

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "benefits" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "faqs" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "tagline" TEXT,
ADD COLUMN     "trainingSelection" JSONB;
