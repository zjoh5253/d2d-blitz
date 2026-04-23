-- AlterTable: add reconciliation and SLA fields to payout_batches
ALTER TABLE "payout_batches"
  ADD COLUMN "total_installs"      INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "matched_installs"    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "reconciliation_rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "sla_deadline"        TIMESTAMP(3),
  ADD COLUMN "sla_alerted_at"      TIMESTAMP(3);

-- CreateTable: payout_batch_audit_logs
CREATE TABLE "payout_batch_audit_logs" (
    "id"             TEXT NOT NULL,
    "batch_id"       TEXT NOT NULL,
    "action"         TEXT NOT NULL,
    "performed_by_id" TEXT,
    "total_payout"   DOUBLE PRECISION,
    "notes"          TEXT,
    "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payout_batch_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payout_batch_audit_logs_batch_id_idx" ON "payout_batch_audit_logs"("batch_id");

-- CreateIndex
CREATE INDEX "payout_batch_audit_logs_performed_by_id_idx" ON "payout_batch_audit_logs"("performed_by_id");

-- AddForeignKey
ALTER TABLE "payout_batch_audit_logs" ADD CONSTRAINT "payout_batch_audit_logs_batch_id_fkey"
  FOREIGN KEY ("batch_id") REFERENCES "payout_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payout_batch_audit_logs" ADD CONSTRAINT "payout_batch_audit_logs_performed_by_id_fkey"
  FOREIGN KEY ("performed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
