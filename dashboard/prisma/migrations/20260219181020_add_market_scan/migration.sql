-- CreateTable
CREATE TABLE "MarketScan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "industry" TEXT NOT NULL,
    "niche" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "opportunities" JSONB,
    "metadata" JSONB,
    "githubIssue" INTEGER,
    "githubIssueUrl" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketScan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MarketScan_userId_idx" ON "MarketScan"("userId");

-- CreateIndex
CREATE INDEX "MarketScan_status_idx" ON "MarketScan"("status");

-- AddForeignKey
ALTER TABLE "MarketScan" ADD CONSTRAINT "MarketScan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
