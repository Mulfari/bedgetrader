-- AlterTable
ALTER TABLE "SubAccount" ADD COLUMN     "isDemo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "SubAccount_userId_idx" ON "SubAccount"("userId");
