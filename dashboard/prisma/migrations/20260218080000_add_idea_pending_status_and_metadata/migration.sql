-- AlterEnum
ALTER TYPE "IdeaStatus" ADD VALUE 'PENDING' BEFORE 'DRAFT';

-- AlterTable
ALTER TABLE "Idea" ADD COLUMN "metadata" JSONB;
