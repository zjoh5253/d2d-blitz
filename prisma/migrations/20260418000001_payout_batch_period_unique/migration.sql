-- DropIndex: remove redundant period index (unique constraint creates its own)
DROP INDEX IF EXISTS "payout_batches_period_idx";

-- CreateIndex: unique constraint on period to prevent duplicate batch creation race conditions
CREATE UNIQUE INDEX "payout_batches_period_key" ON "payout_batches"("period");
