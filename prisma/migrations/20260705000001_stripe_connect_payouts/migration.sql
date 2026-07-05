-- Migration: stripe_connect_payouts
-- Adds Stripe Connect Express payout support:
--   * stripe_connected_accounts — a rep's connected Express account + capability flags
--   * payout_transfers          — one row per Stripe Transfer created when a batch is paid

-- CreateEnum
CREATE TYPE "StripeOnboardingStatus" AS ENUM ('NOT_STARTED', 'PENDING', 'ACTIVE', 'RESTRICTED');

-- CreateEnum
CREATE TYPE "TransferStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'REVERSED');

-- CreateTable
CREATE TABLE "stripe_connected_accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "stripe_account_id" TEXT NOT NULL,
    "onboarding_status" "StripeOnboardingStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "details_submitted" BOOLEAN NOT NULL DEFAULT false,
    "charges_enabled" BOOLEAN NOT NULL DEFAULT false,
    "payouts_enabled" BOOLEAN NOT NULL DEFAULT false,
    "default_currency" TEXT NOT NULL DEFAULT 'usd',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stripe_connected_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payout_transfers" (
    "id" TEXT NOT NULL,
    "payout_line_id" TEXT NOT NULL,
    "rep_id" TEXT NOT NULL,
    "stripe_account_id" TEXT NOT NULL,
    "stripe_transfer_id" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "status" "TransferStatus" NOT NULL DEFAULT 'PENDING',
    "failure_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payout_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stripe_connected_accounts_user_id_key" ON "stripe_connected_accounts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "stripe_connected_accounts_stripe_account_id_key" ON "stripe_connected_accounts"("stripe_account_id");

-- CreateIndex
CREATE INDEX "stripe_connected_accounts_stripe_account_id_idx" ON "stripe_connected_accounts"("stripe_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "payout_transfers_payout_line_id_key" ON "payout_transfers"("payout_line_id");

-- CreateIndex
CREATE UNIQUE INDEX "payout_transfers_stripe_transfer_id_key" ON "payout_transfers"("stripe_transfer_id");

-- CreateIndex
CREATE INDEX "payout_transfers_rep_id_idx" ON "payout_transfers"("rep_id");

-- CreateIndex
CREATE INDEX "payout_transfers_status_idx" ON "payout_transfers"("status");

-- AddForeignKey
ALTER TABLE "stripe_connected_accounts" ADD CONSTRAINT "stripe_connected_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payout_transfers" ADD CONSTRAINT "payout_transfers_payout_line_id_fkey" FOREIGN KEY ("payout_line_id") REFERENCES "payout_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payout_transfers" ADD CONSTRAINT "payout_transfers_rep_id_fkey" FOREIGN KEY ("rep_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
