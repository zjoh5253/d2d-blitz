-- Migration: manager_payroll_instant_payout
-- Makes managers/owners payable (override_earnings), supports manager-initiated
-- payroll runs (payout_batches.initiated_by_id), and adds Instant Payout
-- (payout method + instant-fee tracking).

-- CreateEnum
CREATE TYPE "OverrideRole" AS ENUM ('MANAGER_OVERRIDE', 'MARKET_OWNER_SPREAD');

-- CreateEnum
CREATE TYPE "PayoutMethod" AS ENUM ('STANDARD', 'INSTANT');

-- AlterTable: rep/manager payout-method preference
ALTER TABLE "stripe_connected_accounts" ADD COLUMN "payout_method" "PayoutMethod" NOT NULL DEFAULT 'STANDARD';

-- AlterTable: record how a transfer was paid out + any instant fee
ALTER TABLE "payout_transfers" ADD COLUMN "method" "PayoutMethod" NOT NULL DEFAULT 'STANDARD';
ALTER TABLE "payout_transfers" ADD COLUMN "instant_fee" DOUBLE PRECISION;
ALTER TABLE "payout_transfers" ADD COLUMN "stripe_payout_id" TEXT;

-- AlterTable: who initiated a payroll run (null = admin/company global batch)
ALTER TABLE "payout_batches" ADD COLUMN "initiated_by_id" TEXT;

-- CreateTable
CREATE TABLE "override_earnings" (
    "id" TEXT NOT NULL,
    "commission_record_id" TEXT NOT NULL,
    "payee_id" TEXT NOT NULL,
    "role" "OverrideRole" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" "CommissionStatus" NOT NULL DEFAULT 'ELIGIBLE',
    "payout_batch_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "override_earnings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payout_transfers_stripe_payout_id_key" ON "payout_transfers"("stripe_payout_id");
CREATE INDEX "payout_batches_initiated_by_id_idx" ON "payout_batches"("initiated_by_id");
CREATE UNIQUE INDEX "override_earnings_commission_record_id_role_key" ON "override_earnings"("commission_record_id", "role");
CREATE INDEX "override_earnings_payee_id_idx" ON "override_earnings"("payee_id");
CREATE INDEX "override_earnings_status_idx" ON "override_earnings"("status");
CREATE INDEX "override_earnings_payout_batch_id_idx" ON "override_earnings"("payout_batch_id");

-- AddForeignKey
ALTER TABLE "payout_batches" ADD CONSTRAINT "payout_batches_initiated_by_id_fkey" FOREIGN KEY ("initiated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "override_earnings" ADD CONSTRAINT "override_earnings_commission_record_id_fkey" FOREIGN KEY ("commission_record_id") REFERENCES "commission_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "override_earnings" ADD CONSTRAINT "override_earnings_payee_id_fkey" FOREIGN KEY ("payee_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "override_earnings" ADD CONSTRAINT "override_earnings_payout_batch_id_fkey" FOREIGN KEY ("payout_batch_id") REFERENCES "payout_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
