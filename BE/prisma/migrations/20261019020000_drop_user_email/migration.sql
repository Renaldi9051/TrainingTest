-- Satu admin, login hanya kata sandi: kolom email tidak dipakai lagi.

-- DropIndex
DROP INDEX "User_email_key";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "email";
