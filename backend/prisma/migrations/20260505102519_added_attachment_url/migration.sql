-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "attachmentUrl" TEXT,
ALTER COLUMN "content" DROP NOT NULL;
