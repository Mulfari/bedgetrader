-- CreateTable
CREATE TABLE "Position" (
    "id" TEXT NOT NULL,
    "externalId" TEXT,
    "subAccountId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "positionType" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "leverage" TEXT NOT NULL,
    "entryPrice" TEXT NOT NULL,
    "markPrice" TEXT,
    "status" TEXT NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "exitPrice" TEXT,
    "realisedPnl" TEXT,
    "unrealisedPnl" TEXT,
    "commission" TEXT,
    "settlementCurrency" TEXT NOT NULL,
    "stopLossPrice" TEXT,
    "takeProfitPrice" TEXT,
    "liquidationPrice" TEXT,
    "margin" TEXT,
    "isDemo" BOOLEAN NOT NULL,
    "exchange" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "tags" TEXT,
    "durationSeconds" INTEGER,
    "percentageReturn" DOUBLE PRECISION,
    "maxDrawdown" DOUBLE PRECISION,

    CONSTRAINT "Position_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Position_subAccountId_idx" ON "Position"("subAccountId");

-- CreateIndex
CREATE INDEX "Position_userId_idx" ON "Position"("userId");

-- CreateIndex
CREATE INDEX "Position_symbol_idx" ON "Position"("symbol");

-- CreateIndex
CREATE INDEX "Position_status_idx" ON "Position"("status");

-- CreateIndex
CREATE INDEX "Position_openedAt_idx" ON "Position"("openedAt");

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_subAccountId_fkey" FOREIGN KEY ("subAccountId") REFERENCES "SubAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
