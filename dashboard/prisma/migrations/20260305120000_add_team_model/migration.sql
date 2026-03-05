-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- AlterTable: Add teamId to User
ALTER TABLE "User" ADD COLUMN "teamId" TEXT;

-- AlterTable: Add teamId to Idea
ALTER TABLE "Idea" ADD COLUMN "teamId" TEXT;

-- AlterTable: Add teamId to Pack
ALTER TABLE "Pack" ADD COLUMN "teamId" TEXT;

-- AlterTable: Add teamId to MarketScan
ALTER TABLE "MarketScan" ADD COLUMN "teamId" TEXT;

-- Seed default team
INSERT INTO "Team" ("id", "name", "createdAt", "updatedAt")
VALUES ('default-team', 'Default Team', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Assign all existing records to default team
UPDATE "User" SET "teamId" = 'default-team' WHERE "teamId" IS NULL;
UPDATE "Idea" SET "teamId" = 'default-team' WHERE "teamId" IS NULL;
UPDATE "Pack" SET "teamId" = 'default-team' WHERE "teamId" IS NULL;
UPDATE "MarketScan" SET "teamId" = 'default-team' WHERE "teamId" IS NULL;

-- CreateIndex
CREATE INDEX "User_teamId_idx" ON "User"("teamId");
CREATE INDEX "Idea_teamId_idx" ON "Idea"("teamId");
CREATE INDEX "Idea_teamId_status_idx" ON "Idea"("teamId", "status");
CREATE INDEX "Pack_teamId_idx" ON "Pack"("teamId");
CREATE INDEX "MarketScan_teamId_idx" ON "MarketScan"("teamId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Idea" ADD CONSTRAINT "Idea_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Pack" ADD CONSTRAINT "Pack_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MarketScan" ADD CONSTRAINT "MarketScan_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
