-- Migration: add onboarding agreements
-- Adds the AgreementType enum plus the agreements and agreement_acceptances
-- tables that back the rep onboarding gate (rep agreement, GPS consent,
-- background check consent, and W-9 upload).

-- CreateEnum
CREATE TYPE "AgreementType" AS ENUM ('REP_AGREEMENT', 'GPS_CONSENT', 'TAX_W9', 'BACKGROUND_CHECK');

-- CreateTable
CREATE TABLE "agreements" (
    "id" TEXT NOT NULL,
    "type" "AgreementType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "blocking" BOOLEAN NOT NULL DEFAULT true,
    "requires_upload" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agreements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agreement_acceptances" (
    "id" TEXT NOT NULL,
    "agreement_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "signature_name" TEXT NOT NULL,
    "document_url" TEXT,
    "accepted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agreement_acceptances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agreements_type_idx" ON "agreements"("type");

-- CreateIndex
CREATE INDEX "agreements_is_active_idx" ON "agreements"("is_active");

-- CreateIndex
CREATE INDEX "agreement_acceptances_user_id_idx" ON "agreement_acceptances"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "agreement_acceptances_user_id_agreement_id_key" ON "agreement_acceptances"("user_id", "agreement_id");

-- AddForeignKey
ALTER TABLE "agreement_acceptances" ADD CONSTRAINT "agreement_acceptances_agreement_id_fkey" FOREIGN KEY ("agreement_id") REFERENCES "agreements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agreement_acceptances" ADD CONSTRAINT "agreement_acceptances_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
