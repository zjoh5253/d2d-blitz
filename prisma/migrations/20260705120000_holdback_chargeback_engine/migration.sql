-- Migration: holdback_chargeback_engine
-- Adds the retention-holdback + chargeback engine:
--   * holdback_policies — configurable holdback % / duration (global default + per carrier)
--   * holdbacks         — the reserved slice of each rep commission (source of truth)
--   * chargebacks       — permanent audit of carrier chargebacks
-- Also adds the CHARGEBACK sale status.

-- AlterEnum
ALTER TYPE "SaleStatus" ADD VALUE 'CHARGEBACK';

-- CreateEnum
CREATE TYPE "HoldbackStatus" AS ENUM ('HELD', 'RELEASED', 'CLAWED_BACK');

-- CreateEnum
CREATE TYPE "ChargebackStatus" AS ENUM ('OPEN', 'RECOVERED', 'WRITTEN_OFF');

-- CreateTable
CREATE TABLE "holdback_policies" (
    "id" TEXT NOT NULL,
    "carrier_id" TEXT,
    "holdback_percent" DOUBLE PRECISION NOT NULL,
    "holdback_days" INTEGER NOT NULL,
    "effective_date" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "holdback_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "holdbacks" (
    "id" TEXT NOT NULL,
    "commission_record_id" TEXT NOT NULL,
    "rep_id" TEXT NOT NULL,
    "carrier_id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "percent" DOUBLE PRECISION NOT NULL,
    "release_at" TIMESTAMP(3) NOT NULL,
    "status" "HoldbackStatus" NOT NULL DEFAULT 'HELD',
    "released_at" TIMESTAMP(3),
    "payout_batch_id" TEXT,
    "chargeback_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "holdbacks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chargebacks" (
    "id" TEXT NOT NULL,
    "sale_id" TEXT NOT NULL,
    "commission_record_id" TEXT,
    "rep_id" TEXT NOT NULL,
    "carrier_id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "held_applied" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "outstanding_balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "ChargebackStatus" NOT NULL DEFAULT 'OPEN',
    "reason" TEXT NOT NULL,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chargebacks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "holdback_policies_carrier_id_idx" ON "holdback_policies"("carrier_id");
CREATE INDEX "holdback_policies_effective_date_idx" ON "holdback_policies"("effective_date");

-- CreateIndex
CREATE UNIQUE INDEX "holdbacks_commission_record_id_key" ON "holdbacks"("commission_record_id");
CREATE INDEX "holdbacks_rep_id_idx" ON "holdbacks"("rep_id");
CREATE INDEX "holdbacks_carrier_id_idx" ON "holdbacks"("carrier_id");
CREATE INDEX "holdbacks_status_idx" ON "holdbacks"("status");
CREATE INDEX "holdbacks_release_at_idx" ON "holdbacks"("release_at");
CREATE INDEX "holdbacks_payout_batch_id_idx" ON "holdbacks"("payout_batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "chargebacks_sale_id_key" ON "chargebacks"("sale_id");
CREATE UNIQUE INDEX "chargebacks_commission_record_id_key" ON "chargebacks"("commission_record_id");
CREATE INDEX "chargebacks_rep_id_idx" ON "chargebacks"("rep_id");
CREATE INDEX "chargebacks_carrier_id_idx" ON "chargebacks"("carrier_id");
CREATE INDEX "chargebacks_status_idx" ON "chargebacks"("status");

-- AddForeignKey
ALTER TABLE "holdback_policies" ADD CONSTRAINT "holdback_policies_carrier_id_fkey" FOREIGN KEY ("carrier_id") REFERENCES "carriers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "holdbacks" ADD CONSTRAINT "holdbacks_commission_record_id_fkey" FOREIGN KEY ("commission_record_id") REFERENCES "commission_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "holdbacks" ADD CONSTRAINT "holdbacks_rep_id_fkey" FOREIGN KEY ("rep_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "holdbacks" ADD CONSTRAINT "holdbacks_carrier_id_fkey" FOREIGN KEY ("carrier_id") REFERENCES "carriers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "holdbacks" ADD CONSTRAINT "holdbacks_payout_batch_id_fkey" FOREIGN KEY ("payout_batch_id") REFERENCES "payout_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "holdbacks" ADD CONSTRAINT "holdbacks_chargeback_id_fkey" FOREIGN KEY ("chargeback_id") REFERENCES "chargebacks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chargebacks" ADD CONSTRAINT "chargebacks_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "chargebacks" ADD CONSTRAINT "chargebacks_commission_record_id_fkey" FOREIGN KEY ("commission_record_id") REFERENCES "commission_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "chargebacks" ADD CONSTRAINT "chargebacks_rep_id_fkey" FOREIGN KEY ("rep_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "chargebacks" ADD CONSTRAINT "chargebacks_carrier_id_fkey" FOREIGN KEY ("carrier_id") REFERENCES "carriers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "chargebacks" ADD CONSTRAINT "chargebacks_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
